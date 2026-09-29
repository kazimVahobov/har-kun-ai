import type { ApiError, DeltaEvent, DoneEvent, StreamEvent } from './contract.js'

/**
 * Инкрементальный разбор text/event-stream.
 *
 * Модуль намеренно ничего не знает ни про `fetch`, ни про потоки: на вход
 * строки, на выход кадры. Отсюда две вещи — его можно тестировать без сети
 * и он одинаково работает на клиенте (поток от нашего сервера) и на сервере
 * (поток от OpenRouter).
 *
 * Главное требование — переживать чанки, которые режут кадр в любом месте.
 * Границы TCP-чанков не совпадают с границами событий, и парсер, который
 * читает чанк как законченный кусок, ломается только под нагрузкой.
 */

export interface SseFrame {
  /** Имя события. По спецификации без `event:` это `message`. */
  event: string
  data: string
  id: string | undefined
}

export interface SseParser {
  /** Скормить очередной кусок потока и забрать все кадры, которые он завершил. */
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
    // Кадр без единой строки `data:` не событие: по спецификации он лишь
    // сбрасывает накопленное имя.
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
    // Строка-комментарий. Наш сервер шлёт такие как keepalive, OpenRouter —
    // свои `: OPENROUTER PROCESSING`. И то и другое нужно молча пропускать.
    if (line.startsWith(':')) return null

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    // Срезается ровно один пробел после двоеточия, остальные — часть данных.
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
        // `retry` и незнакомые поля игнорируются.
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
 * Отрезает одну завершённую строку. Незавершённый хвост остаётся в буфере —
 * именно он и есть разрезанный кадр.
 */
function takeLine(buffer: string): { line: string; rest: string } | null {
  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index]

    if (char === '\n') {
      return { line: buffer.slice(0, index), rest: buffer.slice(index + 1) }
    }

    if (char === '\r') {
      // `\r` последним символом буфера — возможно, начало `\r\n`, разрезанного
      // между чанками. Ждём продолжения, иначе получим лишнюю пустую строку
      // и диспатчнем кадр раньше времени.
      if (index === buffer.length - 1) return null

      const skip = buffer[index + 1] === '\n' ? 2 : 1
      return { line: buffer.slice(0, index), rest: buffer.slice(index + skip) }
    }
  }

  return null
}

/**
 * Кадр → событие контракта. Незнакомые имена и битый JSON пропускаются:
 * поток не должен падать из-за события, которого клиент не знает.
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
