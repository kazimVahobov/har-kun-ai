import { describe, expect, it, vi } from 'vitest'
import type { ApiError, DoneEvent } from '../../shared/contract.js'
import { runChatStream, type ChatStreamHandlers } from './chatStream.js'

const REQUEST = { messages: [{ role: 'user' as const, content: 'hi' }] }

const DELTA = (text: string) => `event: delta\ndata: ${JSON.stringify({ text })}\n\n`
const DONE = 'event: done\ndata: {"reason":"stop","model":"mock/lorem:free","chars":5}\n\n'

interface Recorded {
  deltas: string[]
  done: DoneEvent | undefined
  error: ApiError | undefined
  stopped: boolean
  handlers: ChatStreamHandlers
}

function recorder(): Recorded {
  const recorded: Recorded = {
    deltas: [],
    done: undefined,
    error: undefined,
    stopped: false,
    handlers: {
      onDelta: (text) => recorded.deltas.push(text),
      onDone: (event) => (recorded.done = event),
      onError: (error) => (recorded.error = error),
      onStopped: () => (recorded.stopped = true),
    },
  }
  return recorded
}

/** A response whose body is fed piece by piece, so a test drives the timing. */
function streamingResponse(): {
  response: Response
  push: (chunk: string) => void
  close: () => void
  /** Ends the body with no `done` event — a severed connection. */
  sever: () => void
} {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array>

  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })

  return {
    response: new Response(body, { status: 200 }),
    push: (chunk) => controller.enqueue(encoder.encode(chunk)),
    close: () => controller.close(),
    sever: () => controller.close(),
  }
}

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function fetchReturning(response: Response | Promise<Response>): typeof fetch {
  return (() => Promise.resolve(response)) as unknown as typeof fetch
}

describe('a normal stream', () => {
  it('reports every delta and then done', async () => {
    const recorded = recorder()
    const stream = streamingResponse()

    const finished = runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(stream.response),
    })

    stream.push(DELTA('Lorem '))
    stream.push(DELTA('ipsum'))
    stream.push(DONE)
    stream.close()
    await finished

    expect(recorded.deltas).toEqual(['Lorem ', 'ipsum'])
    expect(recorded.done).toEqual({ reason: 'stop', model: 'mock/lorem:free', chars: 5 })
    expect(recorded.error).toBeUndefined()
  })

  it('reassembles frames split across chunks', async () => {
    const recorded = recorder()
    const stream = streamingResponse()

    const finished = runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(stream.response),
    })

    // What the mock does on purpose, and what TCP does anyway.
    stream.push('event: delta\ndata: {"te')
    stream.push('xt":"split"}\n\n')
    stream.push(DONE)
    stream.close()
    await finished

    expect(recorded.deltas).toEqual(['split'])
  })

  it('ignores keepalive comments', async () => {
    const recorded = recorder()
    const stream = streamingResponse()

    const finished = runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(stream.response),
    })

    stream.push(':\n\n')
    stream.push(': OPENROUTER PROCESSING\n\n')
    stream.push(DELTA('after keepalive'))
    stream.push(DONE)
    stream.close()
    await finished

    expect(recorded.deltas).toEqual(['after keepalive'])
  })
})

describe('errors before the stream starts', () => {
  it('reads the contract error out of the body', async () => {
    const recorded = recorder()

    await runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(
        jsonResponse(429, {
          error: { code: 'rate_limited', message: 'Модель занята', retryAfter: 12 },
        }),
      ),
    })

    expect(recorded.error).toEqual({
      code: 'rate_limited',
      message: 'Модель занята',
      retryAfter: 12,
    })
  })

  it('takes retryAfter from the header when the body omits it', async () => {
    const recorded = recorder()

    await runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(
        jsonResponse(
          429,
          { error: { code: 'rate_limited', message: 'Модель занята' } },
          { 'Retry-After': '30' },
        ),
      ),
    })

    expect(recorded.error?.retryAfter).toBe(30)
  })

  it('falls back to the status when the body is not readable', async () => {
    // A proxy can answer with HTML. That must still become a legible message
    // rather than reaching the user raw.
    const recorded = recorder()

    await runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(new Response('<html>502</html>', { status: 502 })),
    })

    expect(recorded.error?.code).toBe('upstream_error')
    expect(recorded.error?.message).not.toContain('<html>')
  })
})

describe('failures mid-stream', () => {
  it('passes an error event through, keeping what arrived before it', async () => {
    const recorded = recorder()
    const stream = streamingResponse()

    const finished = runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(stream.response),
    })

    stream.push(DELTA('half an answer'))
    stream.push('event: error\ndata: {"code":"upstream_error","message":"Оборвалась"}\n\n')
    stream.close()
    await finished

    expect(recorded.deltas).toEqual(['half an answer'])
    expect(recorded.error).toEqual({ code: 'upstream_error', message: 'Оборвалась' })
  })

  it('treats a body that ends without done as a severed connection', async () => {
    const recorded = recorder()
    const stream = streamingResponse()

    const finished = runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(stream.response),
    })

    stream.push(DELTA('the beginning'))
    stream.sever()
    await finished

    expect(recorded.deltas).toEqual(['the beginning'])
    expect(recorded.error?.code).toBe('upstream_unavailable')
    expect(recorded.done).toBeUndefined()
  })

  it('reports a rejected fetch as a lost connection', async () => {
    const recorded = recorder()

    await runChatStream({
      request: REQUEST,
      signal: new AbortController().signal,
      handlers: recorded.handlers,
      fetchImpl: (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch,
    })

    expect(recorded.error?.code).toBe('upstream_unavailable')
    expect(recorded.stopped).toBe(false)
  })
})

describe('cancellation', () => {
  it('reports a stop, not an error, and keeps the deltas already delivered', async () => {
    const recorded = recorder()
    const stream = streamingResponse()
    const controller = new AbortController()

    const finished = runChatStream({
      request: REQUEST,
      signal: controller.signal,
      handlers: recorded.handlers,
      fetchImpl: fetchReturning(stream.response),
    })

    stream.push(DELTA('half'))
    await Promise.resolve()
    controller.abort()
    await finished

    expect(recorded.deltas).toEqual(['half'])
    expect(recorded.stopped).toBe(true)
    expect(recorded.error).toBeUndefined()
  })

  it('a stop before the response arrives is still a stop', async () => {
    const recorded = recorder()
    const controller = new AbortController()
    controller.abort()

    await runChatStream({
      request: REQUEST,
      signal: controller.signal,
      handlers: recorded.handlers,
      fetchImpl: (() =>
        Promise.reject(new DOMException('Aborted', 'AbortError'))) as unknown as typeof fetch,
    })

    expect(recorded.stopped).toBe(true)
    expect(recorded.error).toBeUndefined()
  })
})

describe('stall guards', () => {
  it('times out when no first token arrives', async () => {
    vi.useFakeTimers()
    try {
      const recorded = recorder()
      const stream = streamingResponse()

      const finished = runChatStream({
        request: REQUEST,
        signal: new AbortController().signal,
        handlers: recorded.handlers,
        fetchImpl: fetchReturning(stream.response),
        firstTokenMs: 1000,
      })

      await vi.advanceTimersByTimeAsync(1000)
      await finished

      expect(recorded.error).toEqual({
        code: 'timeout',
        message: 'Модель не ответила за отведённое время.',
      })
      expect(recorded.stopped).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out when the stream stalls mid-answer, keeping the text', async () => {
    vi.useFakeTimers()
    try {
      const recorded = recorder()
      const stream = streamingResponse()

      const finished = runChatStream({
        request: REQUEST,
        signal: new AbortController().signal,
        handlers: recorded.handlers,
        fetchImpl: fetchReturning(stream.response),
        firstTokenMs: 5000,
        idleMs: 1000,
      })

      stream.push(DELTA('started'))
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      await finished

      expect(recorded.deltas).toEqual(['started'])
      expect(recorded.error?.message).toBe('Модель перестала отвечать на середине ответа.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a keepalive does not rearm the guard', async () => {
    // Keepalives keep the connection alive, not the generation. A stream sending
    // nothing else has stalled and must be treated as such.
    vi.useFakeTimers()
    try {
      const recorded = recorder()
      const stream = streamingResponse()

      const finished = runChatStream({
        request: REQUEST,
        signal: new AbortController().signal,
        handlers: recorded.handlers,
        fetchImpl: fetchReturning(stream.response),
        firstTokenMs: 1000,
      })

      await vi.advanceTimersByTimeAsync(600)
      stream.push(':\n\n')
      await vi.advanceTimersByTimeAsync(400)
      await finished

      expect(recorded.error?.code).toBe('timeout')
    } finally {
      vi.useRealTimers()
    }
  })
})
