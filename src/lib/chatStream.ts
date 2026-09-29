import type { ApiError, ChatRequest, DoneEvent, ErrorCode } from '../../shared/contract.js'
import { createSseParser, toStreamEvent } from '../../shared/sse.js'

/**
 * Reading one generation from `POST /api/chat`.
 *
 * `fetch` with a reader rather than `EventSource` — the latter cannot POST, and
 * the whole conversation goes in the body.
 *
 * The module takes `fetch` and an `AbortSignal` as arguments and reports through
 * handlers, so every branch that matters — a mid-stream error, a severed
 * connection, a stall, a cancellation — is reachable in a test without a server.
 */

/**
 * The client's guards sit slightly above the server's (30 s / 20 s) on purpose.
 * A live server reports its own timeout with a better message; these exist for
 * the case where nothing is coming back at all — a wedged process, a silently
 * dead connection — and must not preempt it.
 */
export const CLIENT_FIRST_TOKEN_MS = 35_000
export const CLIENT_IDLE_MS = 25_000

export const CHAT_ENDPOINT = '/api/chat'

const CONNECTION_LOST: ApiError = {
  code: 'upstream_unavailable',
  message: 'Соединение прервано. Проверьте сеть и попробуйте снова.',
}

export interface ChatStreamHandlers {
  onDelta(text: string): void
  onDone(event: DoneEvent): void
  onError(error: ApiError): void
  /** Cancelled by the caller. Not an error: the text received so far stands. */
  onStopped(): void
}

export interface ChatStreamOptions {
  request: ChatRequest
  signal: AbortSignal
  handlers: ChatStreamHandlers
  fetchImpl?: typeof fetch
  endpoint?: string
  firstTokenMs?: number
  idleMs?: number
}

export async function runChatStream(options: ChatStreamOptions): Promise<void> {
  const {
    request,
    signal: external,
    handlers,
    fetchImpl = fetch,
    endpoint = CHAT_ENDPOINT,
    firstTokenMs = CLIENT_FIRST_TOKEN_MS,
    idleMs = CLIENT_IDLE_MS,
  } = options

  const stall = new AbortController()
  const signal = AbortSignal.any([external, stall.signal])

  let sawFirstToken = false
  let timedOut = false
  let stallTimer: ReturnType<typeof setTimeout> | undefined

  const armStall = (): void => {
    clearTimeout(stallTimer)
    stallTimer = setTimeout(
      () => {
        timedOut = true
        stall.abort()
      },
      sawFirstToken ? idleMs : firstTokenMs,
    )
  }

  armStall()

  /**
   * Called when the body ends without a `done` event — whether because the
   * connection died, the caller cancelled, or a guard fired. All three look the
   * same to the reader, so the reason comes from the flags rather than the
   * failure mode.
   */
  const finishWithoutDone = (): void => {
    if (external.aborted) {
      handlers.onStopped()
      return
    }

    if (timedOut) {
      handlers.onError({
        code: 'timeout',
        message: sawFirstToken
          ? 'Модель перестала отвечать на середине ответа.'
          : 'Модель не ответила за отведённое время.',
      })
      return
    }

    // Whatever arrived before this stays — a partial answer is a valid result.
    handlers.onError(CONNECTION_LOST)
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      handlers.onError(await readError(response))
      return
    }

    if (response.body === null) {
      handlers.onError({ code: 'internal', message: 'Пустой ответ сервера.' })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parser = createSseParser()

    // Cancel the reader ourselves rather than trusting the body to react to the
    // signal. A real `fetch` does tear the body down on abort, but relying on
    // that means a body which does not leaves this hanging forever — and the
    // stall guard, whose whole job is to prevent hanging, would hang with it.
    const cancelReader = (): void => {
      void reader.cancel().catch(() => undefined)
    }
    if (signal.aborted) cancelReader()
    else signal.addEventListener('abort', cancelReader, { once: true })

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        const event = toStreamEvent(frame)
        if (event === null) continue

        switch (event.event) {
          case 'delta':
            sawFirstToken = true
            // Only a delta rearms the guard. Keepalive comments keep the
            // connection alive, not the generation — a stream that sends
            // nothing but keepalives has stalled and should be treated as such.
            armStall()
            handlers.onDelta(event.data.text)
            break
          case 'done':
            handlers.onDone(event.data)
            return
          case 'error':
            handlers.onError(event.data)
            return
        }
      }
    }

    finishWithoutDone()
  } catch {
    finishWithoutDone()
  } finally {
    clearTimeout(stallTimer)
  }
}

/**
 * An error before the stream started arrives as JSON with a status. Anything
 * unreadable there still has to become a legible message, so the status is the
 * fallback — a raw body from a proxy must not reach the user.
 */
async function readError(response: Response): Promise<ApiError> {
  const fallback: ApiError = {
    code: codeForStatus(response.status),
    message: messageForStatus(response.status),
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return withRetryAfter(fallback, response)
  }

  if (typeof body !== 'object' || body === null) return withRetryAfter(fallback, response)

  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return withRetryAfter(fallback, response)

  const { code, message, retryAfter } = error as Partial<ApiError>
  const result: ApiError = {
    code: typeof code === 'string' ? (code as ErrorCode) : fallback.code,
    message: typeof message === 'string' && message !== '' ? message : fallback.message,
  }
  if (typeof retryAfter === 'number') result.retryAfter = retryAfter

  return withRetryAfter(result, response)
}

function withRetryAfter(error: ApiError, response: Response): ApiError {
  if (error.retryAfter !== undefined) return error

  const header = response.headers.get('Retry-After')
  if (header === null) return error

  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds > 0 ? { ...error, retryAfter: seconds } : error
}

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'bad_request'
    case 429:
      return 'rate_limited'
    case 502:
      return 'upstream_error'
    case 503:
      return 'upstream_unavailable'
    case 504:
      return 'timeout'
    default:
      return 'internal'
  }
}

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Сервер не принял запрос.'
    case 429:
      return 'Бесплатная модель сейчас занята. Попробуйте позже или смените модель.'
    case 504:
      return 'Модель не ответила за отведённое время.'
    default:
      return 'Сервер не смог ответить. Попробуйте ещё раз.'
  }
}
