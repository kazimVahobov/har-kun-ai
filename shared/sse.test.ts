import { describe, expect, it } from 'vitest'
import { createSseParser, toStreamEvent, type SseFrame } from './sse.js'

/** Скормить парсеру куски и собрать все кадры. */
function feed(chunks: string[]): SseFrame[] {
  const parser = createSseParser()
  return chunks.flatMap((chunk) => parser.push(chunk))
}

const DELTA = 'event: delta\ndata: {"text":"Lorem "}\n\n'
const DONE = 'event: done\ndata: {"reason":"stop","model":"mock/lorem:free","chars":6}\n\n'

describe('разбор кадров', () => {
  it('читает целый кадр', () => {
    expect(feed([DELTA])).toEqual([{ event: 'delta', data: '{"text":"Lorem "}', id: undefined }])
  })

  it('читает несколько кадров из одного куска', () => {
    const frames = feed([DELTA + DELTA + DONE])
    expect(frames.map((frame) => frame.event)).toEqual(['delta', 'delta', 'done'])
  })

  it('не отдаёт кадр, пока не пришла пустая строка', () => {
    const parser = createSseParser()
    expect(parser.push('event: delta\ndata: {"text":"Lorem "}\n')).toEqual([])
    expect(parser.push('\n')).toHaveLength(1)
  })

  it('без event: имя события — message', () => {
    expect(feed(['data: привет\n\n'])[0]?.event).toBe('message')
  })

  it('кадр без data: не событие', () => {
    expect(feed(['event: delta\n\n'])).toEqual([])
  })

  it('склеивает многострочный data через перевод строки', () => {
    expect(feed(['data: одна\ndata: две\n\n'])[0]?.data).toBe('одна\nдве')
  })

  it('срезает ровно один пробел после двоеточия', () => {
    expect(feed(['data:  два пробела\n\n'])[0]?.data).toBe(' два пробела')
  })

  it('поле без двоеточия даёт пустое значение', () => {
    expect(feed(['data\n\n'])[0]?.data).toBe('')
  })

  it('запоминает id и переносит его на следующие кадры', () => {
    const frames = feed(['id: 7\n' + DELTA, DELTA])
    expect(frames.map((frame) => frame.id)).toEqual(['7', '7'])
  })
})

describe('keepalive и комментарии', () => {
  it('пропускает комментарии', () => {
    expect(feed([':\n\n' + DELTA])).toHaveLength(1)
  })

  it('пропускает keepalive OpenRouter', () => {
    expect(feed([': OPENROUTER PROCESSING\n\n' + DELTA])).toHaveLength(1)
  })

  it('комментарий не сбрасывает накопленный кадр', () => {
    const frames = feed(['event: delta\n', ': держим соединение\n', 'data: {"text":"a"}\n\n'])
    expect(frames).toEqual([{ event: 'delta', data: '{"text":"a"}', id: undefined }])
  })
})

describe('рваные кадры — то, ради чего парсер существует', () => {
  it('переживает разрез между event: и data:', () => {
    const frames = feed(['event: delta\n', 'data: {"text":"Lorem "}\n\n'])
    expect(frames).toEqual([{ event: 'delta', data: '{"text":"Lorem "}', id: undefined }])
  })

  it('переживает разрез посреди JSON', () => {
    const frames = feed(['event: delta\ndata: {"tex', 't":"Lorem "}\n\n'])
    expect(frames[0]?.data).toBe('{"text":"Lorem "}')
  })

  it('переживает разрез между двумя переводами строки терминатора', () => {
    const parser = createSseParser()
    expect(parser.push('event: delta\ndata: {"text":"a"}\n')).toEqual([])
    expect(parser.push('\nevent: delta\ndata: {"text":"b"}\n\n')).toHaveLength(2)
  })

  it('переживает разрез посреди \\r\\n', () => {
    const parser = createSseParser()
    // `\r` последним символом чанка нельзя считать концом строки: следующий
    // чанк может начинаться с `\n`, и тогда это один терминатор, а не два.
    expect(parser.push('data: a\r')).toEqual([])
    expect(parser.push('\n\r\n')).toEqual([{ event: 'message', data: 'a', id: undefined }])
  })

  it('понимает все три вида переводов строки', () => {
    expect(feed(['data: a\r\n\r\n'])[0]?.data).toBe('a')
    expect(feed(['data: b\n\n'])[0]?.data).toBe('b')
    // Одиночный `\r` — тоже терминатор, но здесь он не последний байт чанка.
    expect(feed(['data: c\r\rdata: следующий'])[0]?.data).toBe('c')
  })

  it('придерживает завершающий `\\r`, пока не ясно, не половина ли это `\\r\\n`', () => {
    const parser = createSseParser()
    // Кадр не отдаётся: следующий чанк может начаться с `\n`, и тогда это
    // один терминатор, а не два. Поспешить здесь — значит диспатчнуть
    // лишний пустой кадр на каждом `\r\n`, разрезанном между чанками.
    expect(parser.push('data: c\r\r')).toEqual([])
    // Пришёл `\n` — значит, это был `\r\n`, один терминатор. Пустая строка
    // закрывает кадр, и он выходит именно сейчас.
    expect(parser.push('\n')).toEqual([{ event: 'message', data: 'c', id: undefined }])
    expect(parser.push('data: d\n\n')).toEqual([{ event: 'message', data: 'd', id: undefined }])
  })

  it('посимвольная подача даёт тот же результат, что и целиком', () => {
    const stream = DELTA + ':\n\n' + DELTA + DONE
    const whole = feed([stream])
    const byChar = feed([...stream])

    expect(byChar).toEqual(whole)
    expect(byChar).toHaveLength(3)
  })

  it('выдерживает разрез в любой позиции потока', () => {
    const stream = DELTA + DONE
    const whole = feed([stream])

    for (let cut = 1; cut < stream.length; cut += 1) {
      const split = feed([stream.slice(0, cut), stream.slice(cut)])
      expect(split, `разрез на позиции ${cut}`).toEqual(whole)
    }
  })
})

describe('отображение на контракт', () => {
  const parse = (raw: string) => {
    const frame = feed([raw])[0]
    return frame ? toStreamEvent(frame) : null
  }

  it('разбирает delta', () => {
    expect(parse(DELTA)).toEqual({ event: 'delta', data: { text: 'Lorem ' } })
  })

  it('разбирает done', () => {
    expect(parse(DONE)).toEqual({
      event: 'done',
      data: { reason: 'stop', model: 'mock/lorem:free', chars: 6 },
    })
  })

  it('разбирает error', () => {
    const raw = 'event: error\ndata: {"code":"rate_limited","message":"занята","retryAfter":12}\n\n'
    expect(parse(raw)).toEqual({
      event: 'error',
      data: { code: 'rate_limited', message: 'занята', retryAfter: 12 },
    })
  })

  it('пропускает незнакомое событие, а не падает на нём', () => {
    expect(parse('event: usage\ndata: {"tokens":10}\n\n')).toBeNull()
  })

  it('пропускает битый JSON', () => {
    expect(parse('event: delta\ndata: {"text":\n\n')).toBeNull()
  })

  it('пропускает событие с неожиданными полями', () => {
    expect(parse('event: delta\ndata: {"txt":"опечатка"}\n\n')).toBeNull()
    expect(parse('event: done\ndata: {"reason":"unknown"}\n\n')).toBeNull()
  })
})
