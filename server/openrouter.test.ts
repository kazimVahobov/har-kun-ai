import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, ChatRequest, DoneReason } from '../shared/contract.js'
import {
  errorForStatus,
  openRouterProducer,
  parseRetryAfter,
  readUpstreamChunk,
} from './openrouter.js'
import { StreamFailure, type StreamContext } from './stream.js'

/**
 * The upstream payload is the part that is not ours and can change under us, so
 * it is read by a pure function and tested on the shapes OpenRouter actually
 * sends: content, a role-only opener, a finish reason, an error object, and the
 * `[DONE]` sentinel.
 */

const REQUEST: ChatRequest = { messages: [{ role: 'user', content: 'привет' }] }

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('readUpstreamChunk', () => {
  it('reads content out of a delta', () => {
    const chunk = readUpstreamChunk('{"choices":[{"delta":{"content":"при"}}]}')
    expect(chunk).toEqual({ text: 'при', finish: undefined, error: undefined })
  })

  it('treats [DONE] as the end', () => {
    expect(readUpstreamChunk('[DONE]')).toBe('end')
    expect(readUpstreamChunk('  [DONE]  ')).toBe('end')
  })

  it('yields no text for the role-only opening chunk', () => {
    const chunk = readUpstreamChunk('{"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}')
    expect(chunk).toEqual({ text: '', finish: undefined, error: undefined })
  })

  it('reads a null content as no text rather than as "null"', () => {
    const chunk = readUpstreamChunk('{"choices":[{"delta":{"content":null}}]}')
    expect(chunk).toEqual({ text: '', finish: undefined, error: undefined })
  })

  it('distinguishes a truncated answer from a finished one', () => {
    expect(readUpstreamChunk('{"choices":[{"delta":{},"finish_reason":"length"}]}')).toMatchObject({
      finish: 'length',
    })
    expect(readUpstreamChunk('{"choices":[{"delta":{},"finish_reason":"stop"}]}')).toMatchObject({
      finish: 'stop',
    })
  })

  it('collapses the other finish reasons onto stop', () => {
    // An answer cut off by a filter still ends; the contract has no third word
    // for it, and inventing one would mean a state the client cannot render.
    expect(
      readUpstreamChunk('{"choices":[{"delta":{},"finish_reason":"content_filter"}]}'),
    ).toMatchObject({ finish: 'stop' })
  })

  it('carries text and a finish reason arriving together', () => {
    const chunk = readUpstreamChunk('{"choices":[{"delta":{"content":"."},"finish_reason":"stop"}]}')
    expect(chunk).toEqual({ text: '.', finish: 'stop', error: undefined })
  })

  it('maps an error frame through the status vocabulary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const chunk = readUpstreamChunk('{"error":{"code":429,"message":"rate limited"}}')
    expect(chunk).toMatchObject({ error: { code: 'rate_limited' } })
  })

  it('ignores what it cannot use instead of failing the stream', () => {
    // A stream must not die because of a frame we do not understand.
    expect(readUpstreamChunk('')).toBeNull()
    expect(readUpstreamChunk('not json')).toBeNull()
    expect(readUpstreamChunk('null')).toBeNull()
    expect(readUpstreamChunk('{"choices":[]}')).toBeNull()
    expect(readUpstreamChunk('{"id":"gen-1"}')).toBeNull()
  })
})

describe('errorForStatus', () => {
  it('reports a missing or wrong key as our own fault', () => {
    // Nobody at the browser can fix a key, so it is not framed as their problem.
    expect(errorForStatus(401).code).toBe('internal')
  })

  it('does not mistake a gated model for a broken key', () => {
    // OpenRouter answers 403 for a model restricted to particular apps. The key
    // works; this model does not — and picking another one is actionable.
    expect(errorForStatus(403).code).toBe('bad_request')
    expect(errorForStatus(403).message).toBe(errorForStatus(404).message)
  })

  it('treats exhausted credit as a rate limit, because that is what it means here', () => {
    expect(errorForStatus(402).code).toBe('rate_limited')
    expect(errorForStatus(429).code).toBe('rate_limited')
  })

  it('separates unavailable from broken', () => {
    expect(errorForStatus(503).code).toBe('upstream_unavailable')
    expect(errorForStatus(500).code).toBe('upstream_error')
  })

  it('names a bad request as the caller´s', () => {
    expect(errorForStatus(400).code).toBe('bad_request')
    expect(errorForStatus(413).code).toBe('bad_request')
  })

  it('always produces a message to show', () => {
    for (const status of [400, 401, 402, 404, 408, 413, 429, 502, 503, 504, 500, 418]) {
      expect(errorForStatus(status).message).not.toBe('')
    }
  })
})

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-09-29T12:00:00Z')

  function headers(values: Record<string, string>): Headers {
    return new Headers(values)
  }

  it('reads a count of seconds', () => {
    expect(parseRetryAfter(headers({ 'retry-after': '30' }), now)).toBe(30)
  })

  it('reads an HTTP date as the wait until then', () => {
    expect(parseRetryAfter(headers({ 'retry-after': 'Tue, 29 Sep 2026 12:00:45 GMT' }), now)).toBe(45)
  })

  it('falls back to the reset timestamp', () => {
    expect(parseRetryAfter(headers({ 'x-ratelimit-reset': String(now + 20_000) }), now)).toBe(20)
  })

  it('prefers Retry-After when both are present', () => {
    const both = headers({ 'retry-after': '5', 'x-ratelimit-reset': String(now + 90_000) })
    expect(parseRetryAfter(both, now)).toBe(5)
  })

  it('drops a wait it cannot show honestly', () => {
    // The interface renders a countdown. A wrong countdown is worse than none.
    expect(parseRetryAfter(headers({}), now)).toBeUndefined()
    expect(parseRetryAfter(headers({ 'retry-after': '' }), now)).toBeUndefined()
    expect(parseRetryAfter(headers({ 'retry-after': 'soon' }), now)).toBeUndefined()
    expect(parseRetryAfter(headers({ 'retry-after': '0' }), now)).toBeUndefined()
    expect(parseRetryAfter(headers({ 'retry-after': '90000' }), now)).toBeUndefined()
    // A date already past says only that the limit has lifted.
    expect(
      parseRetryAfter(headers({ 'retry-after': 'Tue, 29 Sep 2026 11:59:00 GMT' }), now),
    ).toBeUndefined()
  })
})

// ── The adapter end to end ───────────────────────────────────────────────────

/** An upstream that hands back these byte chunks, exactly as split. */
function upstream(chunks: string[], init: ResponseInit = {}): void {
  vi.stubGlobal('fetch', () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    })
    return Promise.resolve(new Response(body, { status: 200, ...init }))
  })
}

interface Recorder extends StreamContext {
  /** Everything `emit` was given, joined — what the browser would have. */
  readonly text: string
}

function context(signal = new AbortController().signal): Recorder {
  const pieces: string[] = []

  return {
    signal,
    get text() {
      return pieces.join('')
    },
    emit(piece: string) {
      pieces.push(piece)
      return Promise.resolve()
    },
    sever() {
      throw new Error('the adapter must not sever a connection')
    },
  }
}

async function run(ctx: StreamContext): Promise<DoneReason | null> {
  const pump = await openRouterProducer(REQUEST, 'vendor/model:free')(ctx.signal)
  return pump(ctx)
}

/** The contract error behind a rejection, or a failure that says what came instead. */
async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof StreamFailure) return error.apiError
    throw error
  }
  throw new Error('expected the adapter to fail, but it resolved')
}

describe('openRouterProducer', () => {
  it('turns an upstream stream into increments and a reason', async () => {
    upstream([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"При"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"вет"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const ctx = context()
    expect(await run(ctx)).toBe('stop')
    expect(ctx.text).toBe('Привет')
  })

  it('survives frames cut at an arbitrary byte boundary', async () => {
    // TCP splits where it likes; this is the one failure that only shows under load.
    const whole =
      'data: {"choices":[{"delta":{"content":"раз"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"два"},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\n'

    for (let cut = 1; cut < whole.length; cut += 1) {
      upstream([whole.slice(0, cut), whole.slice(cut)])

      const ctx = context()
      expect(await run(ctx)).toBe('stop')
      expect(ctx.text).toBe('раздва')
    }
  })

  it('skips the upstream´s own keepalive comments', async () => {
    upstream([
      ': OPENROUTER PROCESSING\n\n',
      ': OPENROUTER PROCESSING\n\n',
      'data: {"choices":[{"delta":{"content":"ок"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const ctx = context()
    expect(await run(ctx)).toBe('stop')
    expect(ctx.text).toBe('ок')
  })

  it('reports a truncated answer as truncated', async () => {
    upstream([
      'data: {"choices":[{"delta":{"content":"нача"},"finish_reason":"length"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    expect(await run(context())).toBe('length')
  })

  it('keeps the text it received when the stream dies mid-answer', async () => {
    // The one thing the assignment names: a partial answer is not thrown away.
    upstream(['data: {"choices":[{"delta":{"content":"половина"}}]}\n\n'])

    const ctx = context()
    const error = await failureOf(run(ctx))
    expect(error.code).toBe('upstream_error')
    expect(ctx.text).toBe('половина')
  })

  it('distinguishes a stream that said nothing from one that was cut off', async () => {
    upstream([])

    const ctx = context()
    const error = await failureOf(run(ctx))
    expect(error.message).toContain('не прислала')
    expect(ctx.text).toBe('')
  })

  it('raises an error frame arriving mid-stream', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    upstream([
      'data: {"choices":[{"delta":{"content":"нача"}}]}\n\n',
      'data: {"error":{"code":502,"message":"provider died"}}\n\n',
    ])

    const ctx = context()
    expect((await failureOf(run(ctx))).code).toBe('upstream_unavailable')
    expect(ctx.text).toBe('нача')
  })

  it('fails before the stream opens when the upstream refuses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('{"error":{"message":"rate limit"}}', {
          status: 429,
          headers: { 'retry-after': '17' },
        }),
      ),
    )

    // The failure happens while connecting, so it can still carry a status —
    // and the wait the upstream named survives the translation.
    const signal = new AbortController().signal
    const error = await failureOf(openRouterProducer(REQUEST, 'vendor/model:free')(signal))
    expect(error).toMatchObject({ code: 'rate_limited', retryAfter: 17 })
  })

  it('reports an unreachable upstream as unavailable, not as our bug', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')))

    const signal = new AbortController().signal
    const error = await failureOf(openRouterProducer(REQUEST, 'vendor/model:free')(signal))
    expect(error.code).toBe('upstream_unavailable')
  })

  it('does not forward the upstream´s own wording to the browser', async () => {
    // "No auth credentials found" tells a visitor nothing they can act on, and
    // says more about us than they need to know.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response('{"error":{"message":"No auth credentials found"}}', { status: 401 }),
      ),
    )

    const signal = new AbortController().signal
    const error = await failureOf(openRouterProducer(REQUEST, 'vendor/model:free')(signal))
    expect(error.code).toBe('internal')
    expect(error.message).not.toContain('auth')
  })

  it('sends the key as a header and nowhere else', async () => {
    let seen: RequestInit | undefined
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      seen = init
      return Promise.resolve(new Response('', { status: 500 }))
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const signal = new AbortController().signal
    await failureOf(openRouterProducer(REQUEST, 'vendor/model:free')(signal))

    const headers = seen?.headers as Record<string, string>
    expect(headers['Authorization']).toMatch(/^Bearer /)
    expect(String(seen?.body)).not.toContain('Bearer')
  })

  it('stops reading when the request is abandoned', async () => {
    upstream([
      'data: {"choices":[{"delta":{"content":"раз"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"два"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const abort = new AbortController()
    abort.abort()

    // No `done`, no error: a cancelled request is not a failure to report.
    expect(await run(context(abort.signal))).toBeNull()
  })
})
