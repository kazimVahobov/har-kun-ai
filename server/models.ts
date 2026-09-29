import type { Request, Response } from 'express'
import type { ModelInfo, ModelsResponse } from '../shared/contract.js'
import { config } from './env.js'
import { DEFAULT_MODEL, MOCK_MODELS } from './mock.js'

/**
 * The model list the picker is built from.
 *
 * On the mock it is the four profiles. Against OpenRouter it is the live
 * catalogue filtered to `:free`, because that catalogue genuinely changes —
 * models appear, and free tiers are withdrawn. Hard-coding it would mean
 * shipping a list that is wrong by the time anyone runs this.
 *
 * It is still cached and still has a fallback: a catalogue that cannot be
 * fetched should cost the user a stale list, not a broken picker.
 */

const CACHE_MS = 5 * 60 * 1000

/**
 * Read from the live catalogue on 2026-09-29 and used only when it cannot be
 * reached. Being out of date is the expected state of this list; a request for
 * a model that has since lost its free tier fails as a plain `bad_request`.
 */
const FALLBACK: ModelInfo[] = [
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA: Nemotron 3 Super',
    contextLength: 262_144,
  },
  {
    id: 'inclusionai/ling-3.0-flash-sante:free',
    name: 'inclusionAI: Ling 3.0 Flash Sante',
    contextLength: 262_144,
  },
  { id: 'google/gemma-4-31b-it:free', name: 'Google: Gemma 4 31B', contextLength: 262_144 },
]

/**
 * Tried in order; the first one the catalogue actually offers becomes default.
 *
 * The order is not a ranking of the models — it is what answered. All sixteen
 * free models were asked one question on 2026-09-30: these three replied in
 * about a second, while Google's two and Qwen were rate-limited on a shared
 * upstream pool and two more were gated to particular apps. A default that
 * greets a first-time visitor with 429 is a bad default however good the model
 * behind it is, and contention is the one property of a free tier you can
 * measure but not reason about.
 *
 * It will go stale, and that is survivable: this only chooses what is selected
 * first, and the picker holds every free model the catalogue offers.
 */
const PREFERRED = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'inclusionai/ling-3.0-flash-sante:free',
  'google/gemma-4-31b-it:free',
]

interface Catalogue {
  models: ModelInfo[]
  default: string
  fetchedAt: number
  /** False when this is the fallback — worth retrying sooner than a good one. */
  live: boolean
}

let cached: Catalogue | undefined
let inFlight: Promise<Catalogue> | undefined

export async function handleModels(_req: Request, res: Response): Promise<void> {
  if (config.useMock) {
    const body: ModelsResponse = { models: MOCK_MODELS, default: DEFAULT_MODEL }
    res.json(body)
    return
  }

  const catalogue = await loadCatalogue()
  const body: ModelsResponse = { models: catalogue.models, default: catalogue.default }
  res.json(body)
}

/**
 * The default without waiting for anything: `/api/chat` is not the place to
 * discover that a catalogue is slow. Until the first load finishes this is the
 * configured or preferred id, which is also what the load would most likely
 * have chosen.
 */
export function defaultModel(): string {
  if (config.useMock) return DEFAULT_MODEL
  return config.openRouter.model !== '' ? config.openRouter.model : (cached?.default ?? PREFERRED[0] ?? '')
}

/**
 * On the mock only the four profiles exist, so an unknown id is a real mistake
 * and saying so early is a kindness. Against OpenRouter the catalogue moves
 * under us, so the check is on shape alone and the upstream is the authority —
 * its 404 comes back as a `bad_request` naming the model.
 */
export function isAllowedModel(id: string): boolean {
  if (config.useMock) return MOCK_MODELS.some((model) => model.id === id)
  return /^[\w.-]+\/[\w.:-]+$/.test(id)
}

/** Fetched at boot so the first question does not pay for it. Failure is fine. */
export function warmCatalogue(): void {
  if (config.useMock) return

  void loadCatalogue().then(
    (catalogue) => {
      const source = catalogue.live ? 'live catalogue' : 'fallback list'
      console.log(
        `[models] ${source}: ${String(catalogue.models.length)} free models, default ${catalogue.default}`,
      )
    },
    () => {},
  )
}

async function loadCatalogue(): Promise<Catalogue> {
  const fresh = cached !== undefined && Date.now() - cached.fetchedAt < CACHE_MS
  if (fresh && cached !== undefined) return cached

  // Concurrent requests share one fetch rather than racing to replace the cache.
  inFlight ??= fetchCatalogue().finally(() => {
    inFlight = undefined
  })

  return inFlight
}

async function fetchCatalogue(): Promise<Catalogue> {
  try {
    const response = await fetch(`${config.openRouter.baseUrl}/models`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`${String(response.status)} ${response.statusText}`)

    const models = readCatalogue(await response.json())
    if (models.length === 0) throw new Error('no free models in the catalogue')

    cached = { models, default: pickDefault(models), fetchedAt: Date.now(), live: true }
    return cached
  } catch (error) {
    console.error('[models] could not load the catalogue:', describe(error))

    // The previous good list beats the fallback, however stale it is.
    if (cached !== undefined) {
      cached = { ...cached, fetchedAt: Date.now() }
      return cached
    }

    cached = { models: FALLBACK, default: pickDefault(FALLBACK), fetchedAt: Date.now(), live: false }
    return cached
  }
}

/**
 * Only `:free`. The assignment asks for a free model, and a picker that can
 * quietly spend money is not a picker — it is a trap.
 */
export function readCatalogue(payload: unknown): ModelInfo[] {
  if (typeof payload !== 'object' || payload === null) return []

  const { data } = payload as { data?: unknown }
  if (!Array.isArray(data)) return []

  const models: ModelInfo[] = []

  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue

    const { id, name, context_length: contextLength } = entry as Record<string, unknown>
    if (typeof id !== 'string' || !id.endsWith(':free')) continue

    models.push({
      id,
      name: displayName(typeof name === 'string' && name !== '' ? name : id),
      contextLength: typeof contextLength === 'number' ? contextLength : 0,
    })
  }

  return sortModels(models)
}

/** Every entry in this list is free, so saying so on each one is noise. */
function displayName(name: string): string {
  return name.replace(/\s*\(free\)\s*$/i, '').trim()
}

function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    const rank = preferenceRank(a.id) - preferenceRank(b.id)
    return rank !== 0 ? rank : a.name.localeCompare(b.name, 'ru')
  })
}

function preferenceRank(id: string): number {
  const index = PREFERRED.indexOf(id)
  return index === -1 ? PREFERRED.length : index
}

function pickDefault(models: ModelInfo[]): string {
  if (config.openRouter.model !== '') return config.openRouter.model

  for (const id of PREFERRED) {
    if (models.some((model) => model.id === id)) return id
  }
  return models[0]?.id ?? ''
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}
