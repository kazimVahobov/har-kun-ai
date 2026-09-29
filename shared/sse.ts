import type { ApiError, DeltaEvent, DoneEvent, StreamEvent } from './contract.js'

/**
 * Incremental text/event-stream parsing.
 *
 * The module deliberately knows nothing about `fetch` or streams: strings in,
 * frames out. Two things follow — it can be tested without a network, and it
 * works the same on the client (our server's stream) and on the server
 * (OpenRouter's).
 *
 * The core requirement is surviving chunks that cut a frame anywhere. TCP chunk
 * boundaries do not line up with event boundaries, and a parser that reads a
 * chunk as a finished piece only breaks under load.
 */

export interface SseFrame {
  /** The event name. Per the spec, without `event:` it is `message`. */
  event: string
  data: string
  id: string | undefined
}

export interface SseParser {
  /** Feed the next piece of the stream and take every frame it completed. */
  push(chunk: string): SseFrame[]
}

export function createSseParser(): SseParser {
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []
  let lastId: string | undefined

  function reset(): void {
    eventName = ''
    dataLines = []
  }

  function dispatch(): SseFrame | null {
    // A frame without a single `data:` line is not an event: per the spec it
    // merely resets the accumulated event name.
    if (dataLines.length === 0) {
      reset()
      return null
    }

    const frame: SseFrame = {
      event: eventName === '' ? 'message' : eventName,
      data: dataLines.join('\n'),
      id: lastId,
    }
    reset()
    return frame
  }

  function handleLine(line: string): SseFrame | null {
    if (line === '') return dispatch()
    // A comment line. Our server sends these as keepalive, OpenRouter sends its
    // own `: OPENROUTER PROCESSING`. Both are skipped silently.
    if (line.startsWith(':')) return null

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    // Exactly one space after the colon is stripped; the rest is data.
    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'event':
        eventName = value
        break
      case 'data':
        dataLines.push(value)
        break
      case 'id':
        if (!value.includes('\0')) lastId = value
        break
      default:
        // `retry` and unknown fields are ignored.
        break
    }

    return null
  }

  return {
    push(chunk: string): SseFrame[] {
      buffer += chunk
      const frames: SseFrame[] = []

      for (;;) {
        const taken = takeLine(buffer)
        if (taken === null) break

        buffer = taken.rest
        const frame = handleLine(taken.line)
        if (frame !== null) frames.push(frame)
      }

      return frames
    },
  }
}

/**
 * Cuts off one completed line. The unfinished tail stays in the buffer — that
 * tail is precisely the split frame.
 */
function takeLine(buffer: string): { line: string; rest: string } | null {
  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index]

    if (char === '\n') {
      return { line: buffer.slice(0, index), rest: buffer.slice(index + 1) }
    }

    if (char === '\r') {
      // A `\r` as the buffer's last character may be the start of a `\r\n` split
      // across chunks. Wait for more, or we get a spurious empty line and
      // dispatch the frame too early.
      if (index === buffer.length - 1) return null

      const skip = buffer[index + 1] === '\n' ? 2 : 1
      return { line: buffer.slice(0, index), rest: buffer.slice(index + skip) }
    }
  }

  return null
}

/**
 * Frame to contract event. Unknown names and broken JSON are skipped: the stream
 * must not fail because of an event the client does not know.
 */
export function toStreamEvent(frame: SseFrame): StreamEvent | null {
  if (frame.event !== 'delta' && frame.event !== 'done' && frame.event !== 'error') return null

  let payload: unknown
  try {
    payload = JSON.parse(frame.data)
  } catch {
    return null
  }

  if (typeof payload !== 'object' || payload === null) return null

  switch (frame.event) {
    case 'delta':
      return isDelta(payload) ? { event: 'delta', data: payload } : null
    case 'done':
      return isDone(payload) ? { event: 'done', data: payload } : null
    case 'error':
      return isApiError(payload) ? { event: 'error', data: payload } : null
  }
}

function isDelta(value: object): value is DeltaEvent {
  return typeof (value as DeltaEvent).text === 'string'
}

function isDone(value: object): value is DoneEvent {
  const done = value as DoneEvent
  return (done.reason === 'stop' || done.reason === 'length') && typeof done.model === 'string'
}

function isApiError(value: object): value is ApiError {
  const error = value as ApiError
  return typeof error.code === 'string' && typeof error.message === 'string'
}
