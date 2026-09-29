import type { Request, Response } from 'express'
import {
  ERROR_STATUS,
  isSimulateMode,
  type ApiError,
  type ChatMessage,
  type ChatRequest,
  type ErrorResponse,
  type SimulateMode,
} from '../shared/contract.js'
import { config } from './env.js'
import {
  DEFAULT_MODEL,
  buildResponse,
  isKnownModel,
  profileFor,
  randomBetween,
  splitIntoChunks,
  type MockProfile,
} from './mock.js'
import { KEEPALIVE, deltaFrame, doneFrame, errorFrame, openStream, write } from './sse.js'

export async function handleChat(req: Request, res: Response): Promise<void> {
  const parsed = parseRequest(req.body)
  if ('error' in parsed) {
    sendError(res, parsed.error)
    return
  }

  const simulate = readSimulate(req)

  // A 429 arrives before the stream starts, so it goes out as a status, not an event.
  if (simulate === '429') {
    sendError(res, {
      code: 'rate_limited',
      message: 'Бесплатная модель сейчас занята. Попробуйте позже или смените модель.',
      retryAfter: 12,
    })
    return
  }

  if (!config.useMock) {
    sendError(res, {
      code: 'upstream_unavailable',
      message: 'Живая модель ещё не подключена — она появится в фазе 3.',
    })
    return
  }

  await streamMock(res, parsed.value, simulate)
}

// ── Request parsing ──────────────────────────────────────────────────────────

type Parsed = { value: ChatRequest } | { error: ApiError }

function parseRequest(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null) {
    return { error: { code: 'bad_request', message: 'Тело запроса должно быть объектом' } }
  }

  const { messages, model } = body as { messages?: unknown; model?: unknown }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: { code: 'bad_request', message: 'Нужен непустой список сообщений' } }
  }

  if (!messages.every(isChatMessage)) {
    return { error: { code: 'bad_request', message: 'Сообщение должно иметь role и content' } }
  }

  if (model !== undefined) {
    if (typeof model !== 'string' || !isKnownModel(model)) {
      return { error: { code: 'bad_request', message: `Неизвестная модель: ${String(model)}` } }
    }
  }

  return { value: { messages, model: model as string | undefined } }
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const { role, content } = value as { role?: unknown; content?: unknown }
  return (role === 'user' || role === 'assistant') && typeof content === 'string'
}

function readSimulate(req: Request): SimulateMode | undefined {
  if (!config.allowSimulate) return undefined
  const raw = req.query['simulate']
  return isSimulateMode(raw) ? raw : undefined
}

function sendError(res: Response, error: ApiError): void {
  if (error.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(error.retryAfter))
  }
  const body: ErrorResponse = { error }
  res.status(ERROR_STATUS[error.code]).json(body)
}

// ── Streaming ────────────────────────────────────────────────────────────────

async function streamMock(
  res: Response,
  request: ChatRequest,
  simulate: SimulateMode | undefined,
): Promise<void> {
  const model = request.model ?? DEFAULT_MODEL
  const profile = withSimulate(profileFor(model), simulate)

  openStream(res)

  const abort = new AbortController()
  const { signal } = abort

  let settled = false
  let sawFirstToken = false
  let chars = 0
  let stallTimer: NodeJS.Timeout | undefined
  let totalTimer: NodeJS.Timeout | undefined

  const keepalive = setInterval(() => {
    void write(res, KEEPALIVE)
  }, config.keepaliveMs)

  const cleanup = (): void => {
    settled = true
    clearInterval(keepalive)
    clearTimeout(stallTimer)
    clearTimeout(totalTimer)
    abort.abort()
  }

  const settle = async (frame: string): Promise<void> => {
    if (settled) return
    cleanup()
    await write(res, frame)
    res.end()
  }

  /**
   * One stall guard covering two cases: before the first token it is longer
   * (a free model can sit in a queue), afterwards it is shorter and gets
   * rearmed on every chunk.
   */
  const armStall = (): void => {
    clearTimeout(stallTimer)
    const ms = sawFirstToken ? config.timeouts.idleMs : config.timeouts.firstTokenMs
    stallTimer = setTimeout(() => {
      void settle(
        errorFrame({
          code: 'timeout',
          message: sawFirstToken
            ? 'Модель перестала отвечать на середине ответа.'
            : 'Модель не ответила за отведённое время.',
        }),
      )
    }, ms)
  }

  totalTimer = setTimeout(() => {
    void settle(errorFrame({ code: 'timeout', message: 'Запрос шёл слишком долго.' }))
  }, config.timeouts.totalMs)

  // A client cancellation is not an error: write nothing more, log nothing.
  res.on('close', () => {
    if (!settled) cleanup()
  })

  armStall()

  try {
    await delay(randomBetween(profile.firstToken), signal)

    // The `timeout` mode stays silent on purpose; the stall guard does the rest.
    if (simulate === 'timeout') return
    if (signal.aborted || settled) return

    const chunks = splitIntoChunks(buildResponse(profile))
    const breakAt = simulate === 'drop' || simulate === 'mid-error' ? faultIndex(chunks.length) : -1

    for (const [index, chunk] of chunks.entries()) {
      if (signal.aborted || settled) return

      if (index === breakAt) {
        if (simulate === 'drop') {
          // A severed connection with no `done` — what a dropped network looks like.
          cleanup()
          res.destroy()
        } else {
          await settle(
            errorFrame({ code: 'upstream_error', message: 'Модель оборвала генерацию.' }),
          )
        }
        return
      }

      await writeFrame(res, deltaFrame({ text: chunk }), signal)
      chars += chunk.length
      sawFirstToken = true
      armStall()

      await delay(randomBetween(profile.betweenChunks), signal)
    }

    await settle(doneFrame({ reason: 'stop', model, chars }))
  } catch {
    await settle(errorFrame({ code: 'internal', message: 'Не удалось сгенерировать ответ.' }))
  }
}

function withSimulate(profile: MockProfile, simulate: SimulateMode | undefined): MockProfile {
  if (simulate !== 'slow') return profile
  return { ...profile, betweenChunks: [300, 800] }
}

function faultIndex(total: number): number {
  return Math.max(2, Math.floor(total / randomBetween([2, 4])))
}

/**
 * A frame sometimes leaves for the socket as two writes, cut at a random point.
 * TCP chunk boundaries do not line up with SSE event boundaries, and a parser
 * that cannot survive that only breaks in production — here it trips at once.
 */
async function writeFrame(res: Response, frame: string, signal: AbortSignal): Promise<void> {
  if (frame.length < 8 || Math.random() > 0.3) {
    await write(res, frame)
    return
  }

  const cut = randomBetween([1, frame.length - 1])
  await write(res, frame.slice(0, cut))
  if (signal.aborted) return
  await delay(randomBetween([1, 8]), signal)
  await write(res, frame.slice(cut))
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}
