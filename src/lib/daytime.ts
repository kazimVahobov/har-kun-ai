/**
 * The day, as the interface understands it.
 *
 * "Har kun" is Uzbek for "every day", and the product is meant to be an
 * everyday assistant — so the empty screen shows today rather than announcing
 * itself. Everything here is derived from a `Date` passed in, never from the
 * clock directly, which is what makes it testable at the boundaries.
 */

export type DayPart = 'night' | 'morning' | 'afternoon' | 'evening'

export interface DayContext {
  part: DayPart
  greeting: string
  /** 0 at midnight, 1 at the next — where "now" sits along the day. */
  progress: number
  /** "17:42" — what the mark on the day rule is pointing at. */
  time: string
  /** "вторник, 29 сентября" */
  date: string
  /** Rotating starters, chosen to suit the hour. */
  prompts: string[]
}

const GREETINGS: Record<DayPart, string> = {
  night: 'Доброй ночи',
  morning: 'Доброе утро',
  afternoon: 'Добрый день',
  evening: 'Добрый вечер',
}

/**
 * Starters that belong to the hour. This is where "assistant for every day"
 * stops being a slogan and becomes behaviour: what the screen offers at 8am is
 * not what it offers at 11pm.
 */
const PROMPTS: Record<DayPart, string[]> = {
  morning: [
    'Составь план на день из этих задач',
    'Помоги собраться с мыслями перед встречей',
    'Коротко перескажи, о чём эта статья',
  ],
  afternoon: [
    'Разбери эту задачу по шагам',
    'Сформулируй письмо повежливее',
    'Найди слабое место в этом рассуждении',
  ],
  evening: [
    'Подведи итоги дня по этим заметкам',
    'Помоги выбрать из двух вариантов',
    'Перепиши это понятнее',
  ],
  night: [
    'Объясни простыми словами',
    'Запиши мысль, пока не забылась',
    'Что почитать по этой теме',
  ],
}

export function dayPartAt(date: Date): DayPart {
  const hour = date.getHours()
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  if (hour < 23) return 'evening'
  return 'night'
}

export function dayProgressAt(date: Date): number {
  return (date.getHours() * 60 + date.getMinutes()) / (24 * 60)
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export function dayContext(date: Date): DayContext {
  const part = dayPartAt(date)

  return {
    part,
    greeting: GREETINGS[part],
    progress: dayProgressAt(date),
    time: formatTime(date),
    date: formatDate(date),
    prompts: PROMPTS[part],
  }
}
