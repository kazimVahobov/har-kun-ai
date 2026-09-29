import type { ApiError, ChatRequest, DoneReason, ErrorCode } from '../shared/contract.js'
import { createSseParser } from '../shared/sse.js'
import { config } from './env.js'
import { StreamFailure, type Producer, type Pump } from './stream.js'

/**
 * The live model, behind the same contract as the mock.
 *
 * This is the only file that reads the API key, and the key never appears in
 * anything sent to the browser: upstream failures are translated into our own
 * codes and our own wording, and the upstream's own text is logged rather than
 * forwarded. A user cannot act on "No auth credentials found", and it is not
 * their business what our credentials are doing.
 *
 * OpenRouter speaks the OpenAI streaming shape: `data:` frames with no `event:`
 * field, terminated by `data: [DONE]`. The framing is handled by the same
 * parser the client uses on our own stream — only the payload is different.
 */

export function openRouterProducer(request: ChatRequest, model: string): Producer {
  return async (signal: AbortSignal): Promise<Pump> => {
    const response = await callUpstream(request, model, signal)
    return createPump(response)
  }
}

// ── Connecting ───────────────────────────────────────────────────────────────

async function callUpstream(
  request: ChatRequest,
  model: string,
  signal: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.openRouter.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'X-Title': config.openRouter.title,
  }
  if (config.openRouter.referer !== '') {
    headers['HTTP-Referer'] = config.openRouter.referer
  }

  let response: Response
  try {
    response = await fetch(`${config.openRouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages: request.messages, stream: true }),
      signal,
    })
  } catch (error) {
    // An abort is not a failure of ours: the runner reads the signal's reason.
    if (signal.aborted) throw error
    console.error('[openrouter] request failed:', describe(error))
    throw new StreamFailure({
      code: 'upstream_unavailable',
      message: 'Не удалось связаться с моделью. Проверьте соединение и попробуйте ещё раз.',
    })
  }

  if (!response.ok) throw await upstreamFailure(response)

  if (response.body === null) {
    throw new StreamFailure({
      code: 'upstream_error',
      message: 'Модель ответила пустым потоком.',
    })
  }

  return response
}

async function upstreamFailure(response: Response): Promise<StreamFailure> {
  const detail = await readDetail(response)
  console.error(`[openrouter] ${response.status} ${response.statusText}: ${detail}`)

  const error = errorForStatus(response.status)
  const retryAfter = parseRetryAfter(response.headers, Date.now())

  return new StreamFailure(retryAfter === undefined ? error : { ...error, retryAfter })
}

/** Bounded: an upstream error body is for the log, and logs are not a dumping ground. */
async function readDetail(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text.slice(0, 500)
  } catch {
    return '<unreadable body>'
  }
}

// ── Streaming ────────────────────────────────────────────────────────────────

function createPump(response: Response): Pump {
  return async ({ emit, signal }): Promise<DoneReason | null> => {
    // `response.body` is non-null by the time we get here; `callUpstream` checks.
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    const parser = createSseParser()

    /**
     * Cancel the reader explicitly rather than trusting `fetch` to tear the
     * body down when the signal fires. It does not always, and a `read()` that
     * never settles holds the request open for as long as the process lives.
     */
    const cancel = (): void => {
      void reader.cancel().catch(() => {})
    }
    signal.addEventListener('abort', cancel, { once: true })

    let reason: DoneReason | undefined
    let sawText = false

    try {
      reading: for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (signal.aborted) return null

        for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
          const chunk = readUpstreamChunk(frame.data)
          if (chunk === null) continue
          if (chunk === 'end') break reading

          if (chunk.error !== undefined) throw new StreamFailure(chunk.error)

          if (chunk.text !== '') {
            await emit(chunk.text)
            sawText = true
          }
          if (chunk.finish !== undefined) reason = chunk.finish
        }
      }
    } finally {
      signal.removeEventListener('abort', cancel)
    }

    if (signal.aborted) return null
    if (reason !== undefined) return reason

    /**
     * The body ended with neither `[DONE]` nor a `finish_reason`. Whatever text
     * arrived stays on screen — losing it is the one thing the assignment
     * names — but it is not a finished answer and must not be reported as one.
     */
    throw new StreamFailure({
      code: 'upstream_error',
      message: sawText
        ? 'Модель оборвала генерацию.'
        : 'Модель не прислала ответ. Попробуйте ещё раз или смените модель.',
    })
  }
}

// ── The payload ──────────────────────────────────────────────────────────────

export interface UpstreamChunk {
  text: string
  finish: DoneReason | undefined
  error: ApiError | undefined
}

/**
 * One `data:` payload, reduced to what the contract needs. `'end'` is the
 * `[DONE]` sentinel; `null` is anything we have no use for — a keepalive, a
 * chunk carrying only a role, or malformed JSON. None of those is worth
 * failing a stream over.
 */
export function readUpstreamChunk(data: string): UpstreamChunk | 'end' | null {
  const trimmed = data.trim()
  if (trimmed === '') return null
  if (trimmed === '[DONE]') return 'end'

  let payload: unknown
  try {
    payload = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null

  const body = payload as {
    error?: { code?: unknown; message?: unknown }
    choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[]
  }

  if (typeof body.error === 'object' && body.error !== null) {
    return { text: '', finish: undefined, error: chunkError(body.error) }
  }

  const choice = body.choices?.[0]
  if (choice === undefined) return null

  const content = choice.delta?.content
  const finish = choice.finish_reason

  return {
    text: typeof content === 'string' ? content : '',
    // Only `length` is a distinct outcome for us. `content_filter` and
    // `tool_calls` end the answer just as plainly as `stop` does.
    finish: finish === 'length' ? 'length' : typeof finish === 'string' ? 'stop' : undefined,
    error: undefined,
  }
}

function chunkError(raw: { code?: unknown; message?: unknown }): ApiError {
  const status = typeof raw.code === 'number' ? raw.code : 502
  if (typeof raw.message === 'string') {
    console.error(`[openrouter] error frame ${status}: ${raw.message.slice(0, 500)}`)
  }
  return errorForStatus(status)
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/**
 * The upstream's status, in our vocabulary. The wording is ours and is aimed at
 * whoever is looking at the screen: it says what happened and what they can do,
 * and nothing about our configuration.
 */
export function errorForStatus(status: number): ApiError {
  const [code, message] = mapping(status)
  return { code, message }
}

function mapping(status: number): [ErrorCode, string] {
  switch (status) {
    case 400:
      return ['bad_request', 'Модель отклонила запрос.']
    case 401:
    case 403:
      // The key is missing, wrong or out of scope. Nobody at the browser can
      // fix that, so it is our fault and it is logged as ours.
      return ['internal', 'Сервер не настроен для работы с моделью.']
    case 402:
      return ['rate_limited', 'Лимит бесплатных запросов исчерпан. Попробуйте позже.']
    case 404:
      return ['bad_request', 'Такая модель недоступна. Выберите другую.']
    case 408:
      return ['timeout', 'Модель не ответила за отведённое время.']
    case 413:
      return ['bad_request', 'Слишком длинный диалог для этой модели.']
    case 429:
      return ['rate_limited', 'Бесплатная модель сейчас занята. Попробуйте позже или смените модель.']
    case 502:
    case 503:
      return ['upstream_unavailable', 'Модель сейчас недоступна. Попробуйте позже.']
    case 504:
      return ['timeout', 'Модель не ответила за отведённое время.']
    default:
      return status >= 500
        ? ['upstream_error', 'Модель ответила ошибкой.']
        : ['upstream_error', 'Не удалось получить ответ модели.']
  }
}

/**
 * `Retry-After` is either a count of seconds or an HTTP date, and OpenRouter
 * sometimes says the same thing through `X-RateLimit-Reset` (epoch ms) instead.
 * Anything that does not resolve to a sensible future wait is dropped: the
 * interface shows a countdown, and a wrong one is worse than none.
 */
export function parseRetryAfter(headers: Headers, now: number): number | undefined {
  const seconds = fromRetryAfter(headers.get('retry-after'), now)
  if (seconds !== undefined) return seconds

  return fromReset(headers.get('x-ratelimit-reset'), now)
}

function fromRetryAfter(raw: string | null, now: number): number | undefined {
  if (raw === null) return undefined

  const value = raw.trim()
  if (value === '') return undefined

  if (/^\d+$/.test(value)) return bound(Number(value))

  const at = Date.parse(value)
  return Number.isNaN(at) ? undefined : bound(Math.ceil((at - now) / 1000))
}

function fromReset(raw: string | null, now: number): number | undefined {
  if (raw === null) return undefined

  const at = Number(raw.trim())
  if (!Number.isFinite(at) || at <= 0) return undefined

  return bound(Math.ceil((at - now) / 1000))
}

/** A day is already past any wait worth showing, and zero is not a wait. */
function bound(seconds: number): number | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) return undefined
  return seconds
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}
