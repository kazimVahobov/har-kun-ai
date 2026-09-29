import type { Response } from 'express'
import { ERROR_STATUS, type ApiError, type DoneReason, type ErrorResponse } from '../shared/contract.js'
import { config } from './env.js'
import { KEEPALIVE, deltaFrame, doneFrame, errorFrame, openStream, write } from './sse.js'

/**
 * The transport, kept apart from whatever produces the text. Keepalive, the
 * stall guards, backpressure and the single-settlement rule are the same
 * whether the words come from the mock or from a model, and they are the part
 * that is easy to get subtly wrong — so there is one copy of them.
 *
 * The shape follows from one fact about HTTP: a status cannot be changed once
 * headers are sent. So a producer runs in two acts. `connect` happens before
 * any byte of ours goes out, and a failure there is still a real status code.
 * Everything after it can only report failure as an `error` event inside a 200.
 */

/** A failure carrying the contract's error. Where it is caught decides its form. */
export class StreamFailure extends Error {
  constructor(readonly apiError: ApiError) {
    super(apiError.message)
    this.name = 'StreamFailure'
  }
}

export interface StreamContext {
  /** Send one increment and rearm the idle guard. Empty text is ignored. */
  emit(text: string): Promise<void>
  signal: AbortSignal
  /**
   * Cut the connection without a `done`. Only the mock's `drop` mode wants
   * this — it is what a dropped network looks like from the browser. Return
   * `null` afterwards: the response is already settled.
   */
  sever(): void
}

/** Reads the generation. Returns why it ended, or `null` if it settled itself. */
export type Pump = (ctx: StreamContext) => Promise<DoneReason | null>

/** Runs before the stream opens, so it may fail with a status. */
export type Producer = (signal: AbortSignal) => Promise<Pump>

export interface RunOptions {
  /**
   * Cut frames at random points before writing. A testing device: TCP
   * boundaries do not line up with SSE boundaries, and a client parser that
   * assumes they do only breaks in production. The mock turns it on; a real
   * answer is not worth delaying to make a point.
   */
  ragged?: boolean
}

export async function runStream(
  res: Response,
  model: string,
  produce: Producer,
  options: RunOptions = {},
): Promise<void> {
  const abort = new AbortController()
  const { signal } = abort

  let settled = false
  /**
   * Replaced once the streaming phase has timers of its own to clear. Until
   * then there is nothing to tear down but the signal.
   */
  let teardown = (): void => {
    settled = true
    abort.abort()
  }

  // A client cancellation is not an error: write nothing more, log nothing.
  res.on('close', () => {
    if (!settled) teardown()
  })

  // ── Connecting ─────────────────────────────────────────────────────────────

  const connectTimer = setTimeout(() => {
    abort.abort(
      new StreamFailure({ code: 'timeout', message: 'Модель не ответила за отведённое время.' }),
    )
  }, config.timeouts.firstTokenMs)

  let pump: Pump
  try {
    pump = await produce(signal)
  } catch (error) {
    if (!settled) sendError(res, toApiError(error, signal))
    return
  } finally {
    clearTimeout(connectTimer)
  }

  if (settled) return

  // ── Streaming ──────────────────────────────────────────────────────────────

  openStream(res)

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
  teardown = cleanup

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

  armStall()

  const ctx: StreamContext = {
    signal,
    async emit(text: string): Promise<void> {
      if (settled || signal.aborted || text === '') return

      await writeFrame(res, deltaFrame({ text }), signal, options.ragged ?? false)
      chars += text.length
      sawFirstToken = true
      armStall()
    },
    sever(): void {
      if (settled) return
      cleanup()
      res.destroy()
    },
  }

  try {
    const reason = await pump(ctx)
    if (reason !== null) await settle(doneFrame({ reason, model, chars }))
  } catch (error) {
    await settle(errorFrame(toApiError(error, signal)))
  }
}

/** An error before the stream opens: a status and a JSON body. */
export function sendError(res: Response, error: ApiError): void {
  if (error.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(error.retryAfter))
  }
  const body: ErrorResponse = { error }
  res.status(ERROR_STATUS[error.code]).json(body)
}

/**
 * Anything a producer can throw, reduced to the contract. A deadline aborts
 * the signal with its own failure attached, so an `AbortError` raised by
 * `fetch` still reports the reason it was aborted for rather than a generic
 * internal error.
 */
function toApiError(error: unknown, signal: AbortSignal): ApiError {
  if (error instanceof StreamFailure) return error.apiError
  if (signal.reason instanceof StreamFailure) return signal.reason.apiError
  return { code: 'internal', message: 'Не удалось получить ответ модели.' }
}

async function writeFrame(
  res: Response,
  frame: string,
  signal: AbortSignal,
  ragged: boolean,
): Promise<void> {
  if (!ragged || frame.length < 8 || Math.random() > 0.3) {
    await write(res, frame)
    return
  }

  const cut = 1 + Math.floor(Math.random() * (frame.length - 2))
  await write(res, frame.slice(0, cut))
  if (signal.aborted) return
  await delay(1 + Math.floor(Math.random() * 8), signal)
  await write(res, frame.slice(cut))
}

/** Resolves when the request is cancelled or a guard fires. Never on its own. */
export function untilAborted(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
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
