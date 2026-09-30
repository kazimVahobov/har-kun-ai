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
  prompts: Prompt[]
}

export interface Prompt {
  /** One word for the kind of work, so the three read as a set of choices. */
  kicker: string
  /** What goes into the composer, verbatim. */
  text: string
  /** What comes back, so the card says more than the request does. */
  hint: string
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
const PROMPTS: Record<DayPart, Prompt[]> = {
  morning: [
    { kicker: 'план', text: 'Составь план на день', hint: 'по списку задач — что за чем' },
    {
      kicker: 'встреча',
      text: 'Помоги подготовиться к встрече',
      hint: 'тезисы и вопросы, которые стоит задать',
    },
    { kicker: 'текст', text: 'Перескажи статью коротко', hint: 'вставьте ссылку или сам текст' },
  ],
  afternoon: [
    {
      kicker: 'разбор',
      text: 'Разбери задачу по шагам',
      hint: 'от условия до решения, без пропусков',
    },
    { kicker: 'письмо', text: 'Сформулируй письмо повежливее', hint: 'тот же смысл, другой тон' },
    {
      kicker: 'проверка',
      text: 'Найди слабое место в рассуждении',
      hint: 'что здесь не сходится',
    },
  ],
  evening: [
    {
      kicker: 'итоги',
      text: 'Подведи итоги дня',
      hint: 'из заметок — что сделано и что осталось',
    },
    {
      kicker: 'выбор',
      text: 'Помоги выбрать из двух вариантов',
      hint: 'аргументы за и против каждого',
    },
    { kicker: 'текст', text: 'Перепиши это понятнее', hint: 'короче и без канцелярита' },
  ],
  night: [
    { kicker: 'объяснение', text: 'Объясни простыми словами', hint: 'без терминов, как новичку' },
    {
      kicker: 'заметка',
      text: 'Запиши мысль, пока не забылась',
      hint: 'сформулирую её внятно',
    },
    { kicker: 'чтение', text: 'Что почитать по теме', hint: 'подборка с коротким описанием' },
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
