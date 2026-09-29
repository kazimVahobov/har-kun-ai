import { describe, expect, it } from 'vitest'
import { createSseParser, toStreamEvent, type SseFrame } from './sse.js'

/** Feed the parser some pieces and collect every frame. */
function feed(chunks: string[]): SseFrame[] {
  const parser = createSseParser()
  return chunks.flatMap((chunk) => parser.push(chunk))
}

const DELTA = 'event: delta\ndata: {"text":"Lorem "}\n\n'
const DONE = 'event: done\ndata: {"reason":"stop","model":"mock/lorem:free","chars":6}\n\n'

describe('frame parsing', () => {
  it('reads a whole frame', () => {
    expect(feed([DELTA])).toEqual([{ event: 'delta', data: '{"text":"Lorem "}', id: undefined }])
  })

  it('reads several frames from one piece', () => {
    const frames = feed([DELTA + DELTA + DONE])
    expect(frames.map((frame) => frame.event)).toEqual(['delta', 'delta', 'done'])
  })

  it('withholds a frame until the blank line arrives', () => {
    const parser = createSseParser()
    expect(parser.push('event: delta\ndata: {"text":"Lorem "}\n')).toEqual([])
    expect(parser.push('\n')).toHaveLength(1)
  })

  it('names the event message when there is no event: field', () => {
    // Deliberately non-ASCII: the payload travels as UTF-8 and must survive intact.
    expect(feed(['data: привет\n\n'])[0]).toEqual({ event: 'message', data: 'привет', id: undefined })
  })

  it('does not treat a frame without data: as an event', () => {
    expect(feed(['event: delta\n\n'])).toEqual([])
  })

  it('joins multi-line data with a newline', () => {
    expect(feed(['data: one\ndata: two\n\n'])[0]?.data).toBe('one\ntwo')
  })

  it('strips exactly one space after the colon', () => {
    expect(feed(['data:  two spaces\n\n'])[0]?.data).toBe(' two spaces')
  })

  it('gives an empty value to a field with no colon', () => {
    expect(feed(['data\n\n'])[0]?.data).toBe('')
  })

  it('remembers the id and carries it onto later frames', () => {
    const frames = feed(['id: 7\n' + DELTA, DELTA])
    expect(frames.map((frame) => frame.id)).toEqual(['7', '7'])
  })
})

describe('keepalive and comments', () => {
  it('skips comments', () => {
    expect(feed([':\n\n' + DELTA])).toHaveLength(1)
  })

  it("skips OpenRouter's keepalive", () => {
    expect(feed([': OPENROUTER PROCESSING\n\n' + DELTA])).toHaveLength(1)
  })

  it('does not let a comment reset the frame being accumulated', () => {
    const frames = feed(['event: delta\n', ': holding the connection\n', 'data: {"text":"a"}\n\n'])
    expect(frames).toEqual([{ event: 'delta', data: '{"text":"a"}', id: undefined }])
  })
})

describe('split frames — what the parser exists for', () => {
  it('survives a cut between event: and data:', () => {
    const frames = feed(['event: delta\n', 'data: {"text":"Lorem "}\n\n'])
    expect(frames).toEqual([{ event: 'delta', data: '{"text":"Lorem "}', id: undefined }])
  })

  it('survives a cut in the middle of the JSON', () => {
    const frames = feed(['event: delta\ndata: {"tex', 't":"Lorem "}\n\n'])
    expect(frames[0]?.data).toBe('{"text":"Lorem "}')
  })

  it('survives a cut between the terminator\'s two newlines', () => {
    const parser = createSseParser()
    expect(parser.push('event: delta\ndata: {"text":"a"}\n')).toEqual([])
    expect(parser.push('\nevent: delta\ndata: {"text":"b"}\n\n')).toHaveLength(2)
  })

  it('survives a cut in the middle of \\r\\n', () => {
    const parser = createSseParser()
    // A `\r` as the chunk's last character cannot be treated as a line end: the
    // next chunk may start with `\n`, making it one terminator rather than two.
    expect(parser.push('data: a\r')).toEqual([])
    expect(parser.push('\n\r\n')).toEqual([{ event: 'message', data: 'a', id: undefined }])
  })

  it('understands all three line terminators', () => {
    expect(feed(['data: a\r\n\r\n'])[0]?.data).toBe('a')
    expect(feed(['data: b\n\n'])[0]?.data).toBe('b')
    // A lone `\r` is a terminator too, but here it is not the chunk's last byte.
    expect(feed(['data: c\r\rdata: next'])[0]?.data).toBe('c')
  })

  it('holds a trailing `\\r` until it is clear whether it is half of `\\r\\n`', () => {
    const parser = createSseParser()
    // The frame is withheld: the next chunk may start with `\n`, making this one
    // terminator rather than two. Rushing here means dispatching a spurious
    // empty frame on every `\r\n` split across chunks.
    expect(parser.push('data: c\r\r')).toEqual([])
    // A `\n` arrived, so that was a `\r\n` — one terminator. The empty line
    // closes the frame, and it comes out right now.
    expect(parser.push('\n')).toEqual([{ event: 'message', data: 'c', id: undefined }])
    expect(parser.push('data: d\n\n')).toEqual([{ event: 'message', data: 'd', id: undefined }])
  })

  it('gives the same result fed one character at a time as fed whole', () => {
    const stream = DELTA + ':\n\n' + DELTA + DONE
    const whole = feed([stream])
    const byChar = feed([...stream])

    expect(byChar).toEqual(whole)
    expect(byChar).toHaveLength(3)
  })

  it('withstands a cut at every position in the stream', () => {
    const stream = DELTA + DONE
    const whole = feed([stream])

    for (let cut = 1; cut < stream.length; cut += 1) {
      const split = feed([stream.slice(0, cut), stream.slice(cut)])
      expect(split, `cut at position ${cut}`).toEqual(whole)
    }
  })
})

describe('mapping onto the contract', () => {
  const parse = (raw: string) => {
    const frame = feed([raw])[0]
    return frame ? toStreamEvent(frame) : null
  }

  it('parses delta', () => {
    expect(parse(DELTA)).toEqual({ event: 'delta', data: { text: 'Lorem ' } })
  })

  it('parses done', () => {
    expect(parse(DONE)).toEqual({
      event: 'done',
      data: { reason: 'stop', model: 'mock/lorem:free', chars: 6 },
    })
  })

  it('parses error', () => {
    const raw = 'event: error\ndata: {"code":"rate_limited","message":"занята","retryAfter":12}\n\n'
    expect(parse(raw)).toEqual({
      event: 'error',
      data: { code: 'rate_limited', message: 'занята', retryAfter: 12 },
    })
  })

  it('skips an unknown event instead of failing on it', () => {
    expect(parse('event: usage\ndata: {"tokens":10}\n\n')).toBeNull()
  })

  it('skips broken JSON', () => {
    expect(parse('event: delta\ndata: {"text":\n\n')).toBeNull()
  })

  it('skips an event with unexpected fields', () => {
    expect(parse('event: delta\ndata: {"txt":"typo"}\n\n')).toBeNull()
    expect(parse('event: done\ndata: {"reason":"unknown"}\n\n')).toBeNull()
  })
})
