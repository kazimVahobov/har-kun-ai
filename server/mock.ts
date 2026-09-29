import type { ModelInfo } from '../shared/contract.js'

/**
 * The mock model. The job is not "return some text" but to reproduce a live
 * stream's habits: varying speed, varying length, markdown, ragged frames and
 * failures. Against a free model all of that only happens by luck (ADR 0003).
 */

export interface MockProfile {
  /** Delay before the first token, ms. */
  firstToken: [number, number]
  /** Delay between chunks, ms. */
  betweenChunks: [number, number]
  /** Response length, in characters. */
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
 * The identifiers deliberately do not pose as real ones: putting actual `:free`
 * models here would mean inventing a catalogue that changes. It also makes the
 * model picker testable — it genuinely changes how the stream behaves.
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

// ── Text ─────────────────────────────────────────────────────────────────────

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
 * Assembled in blocks and trimmed only on a paragraph or word boundary: cutting
 * inside a code block or a list would emit knowingly broken markdown, which a
 * live model does not do.
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

/** Split into chunks of 1-5 words, like a live model's tokens. */
export function splitIntoChunks(text: string): string[] {
  const pieces = text.split(/(\s+)/).filter((piece) => piece !== '')
  const chunks: string[] = []

  let index = 0
  while (index < pieces.length) {
    const take = randomBetween([2, 10]) // a word and a space count separately
    chunks.push(pieces.slice(index, index + take).join(''))
    index += take
  }

  return chunks.filter((chunk) => chunk !== '')
}
