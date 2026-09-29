import type { ModelInfo } from '../shared/contract.js'

/**
 * Мок-модель. Задача — не «отдать текст», а воспроизвести повадки живого
 * стрима: разную скорость, разную длину, markdown, рваные кадры и отказы.
 * На бесплатной модели всё это ловится только везением (ADR 0003).
 */

export interface MockProfile {
  /** Пауза перед первым токеном, мс. */
  firstToken: [number, number]
  /** Пауза между чанками, мс. */
  betweenChunks: [number, number]
  /** Длина ответа, символов. */
  length: [number, number]
  markdown: 'never' | 'sometimes' | 'always'
}

const DEFAULT_PROFILE: MockProfile = {
  firstToken: [200, 1200],
  betweenChunks: [15, 80],
  length: [200, 1500],
  markdown: 'sometimes',
}

/**
 * Идентификаторы намеренно не маскируются под настоящие: подставлять сюда
 * реальные `:free`-модели значило бы выдумывать каталог, который меняется.
 * Заодно выбор модели в интерфейсе становится проверяемым — он реально
 * меняет поведение потока.
 */
const PROFILES: Record<string, MockProfile> = {
  'mock/lorem:free': DEFAULT_PROFILE,
  'mock/lorem-slow:free': { ...DEFAULT_PROFILE, betweenChunks: [300, 800] },
  'mock/lorem-markdown:free': { ...DEFAULT_PROFILE, markdown: 'always' },
  'mock/lorem-long:free': { ...DEFAULT_PROFILE, length: [2000, 4000] },
}

export const DEFAULT_MODEL = 'mock/lorem:free'

export const MOCK_MODELS: ModelInfo[] = [
  { id: 'mock/lorem:free', name: 'Lorem — обычный', contextLength: 8192 },
  { id: 'mock/lorem-slow:free', name: 'Lorem — медленный', contextLength: 8192 },
  { id: 'mock/lorem-markdown:free', name: 'Lorem — с markdown', contextLength: 8192 },
  { id: 'mock/lorem-long:free', name: 'Lorem — длинный', contextLength: 32768 },
]

export function isKnownModel(id: string): boolean {
  return id in PROFILES
}

export function profileFor(model: string | undefined): MockProfile {
  return (model !== undefined ? PROFILES[model] : undefined) ?? DEFAULT_PROFILE
}

export function randomBetween([min, max]: [number, number]): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

// ── Текст ────────────────────────────────────────────────────────────────────

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur',
  'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui',
  'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

function word(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)] ?? 'lorem'
}

function sentence(min = 5, max = 14): string {
  const count = randomBetween([min, max])
  const words = Array.from({ length: count }, word)
  const first = words[0] ?? 'lorem'
  words[0] = first.charAt(0).toUpperCase() + first.slice(1)
  return `${words.join(' ')}.`
}

function paragraph(): string {
  const count = randomBetween([2, 4])
  return Array.from({ length: count }, () => sentence()).join(' ')
}

function heading(): string {
  const words = Array.from({ length: randomBetween([2, 4]) }, word).join(' ')
  return `## ${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

function list(): string {
  const count = randomBetween([3, 5])
  return Array.from({ length: count }, () => `- ${sentence(3, 8)}`).join('\n')
}

function codeBlock(): string {
  const lines = [
    'const stream = await fetch(url, { signal })',
    'for await (const chunk of read(stream)) {',
    '  render(chunk)',
    '}',
  ]
  return ['```ts', ...lines, '```'].join('\n')
}

function emphasised(): string {
  return `Здесь **важная мысль**, а рядом \`инлайн-код\` и [ссылка](https://example.com).`
}

/**
 * Собирается блоками и обрезается только по границе абзаца или слова: резать
 * посреди блока кода или списка значило бы отдавать заведомо битый markdown,
 * чего живая модель не делает.
 */
export function buildResponse(profile: MockProfile): string {
  const target = randomBetween(profile.length)
  const withMarkdown =
    profile.markdown === 'always' || (profile.markdown === 'sometimes' && Math.random() < 0.4)

  const blocks: string[] = [paragraph()]

  if (withMarkdown) {
    blocks.push(heading(), list(), emphasised(), codeBlock())
  }

  while (blocks.join('\n\n').length < target) {
    blocks.push(paragraph())
  }

  const text = blocks.join('\n\n')
  if (text.length <= target) return text

  const lastBlock = blocks[blocks.length - 1] ?? ''
  const isPlainParagraph = !lastBlock.includes('\n') && !lastBlock.startsWith('- ')
  if (!isPlainParagraph) return text

  const cut = text.lastIndexOf(' ', target)
  return cut > 0 ? `${text.slice(0, cut)}…` : text
}

/** Разбивка на чанки по 1–5 слов — как токены живой модели. */
export function splitIntoChunks(text: string): string[] {
  const pieces = text.split(/(\s+)/).filter((piece) => piece !== '')
  const chunks: string[] = []

  let index = 0
  while (index < pieces.length) {
    const take = randomBetween([2, 10]) // слово + пробел считаются отдельно
    chunks.push(pieces.slice(index, index + take).join(''))
    index += take
  }

  return chunks.filter((chunk) => chunk !== '')
}
