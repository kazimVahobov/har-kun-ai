function num(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number, got: ${raw}`)
  }
  return parsed
}

function text(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback
}

const isProduction = process.env.NODE_ENV === 'production'
const apiKey = text('OPENROUTER_API_KEY')

/**
 * Mock unless a key is present, and `MOCK` overrides either way. Someone who
 * has not set a key wants the mock; someone who has wants the model. Making
 * them say so twice would only be a way to get it wrong.
 */
const useMock = process.env.MOCK === '1' ? true : process.env.MOCK === '0' ? false : apiKey === ''

export const config = {
  port: num('PORT', 8787),
  isProduction,
  useMock,

  /**
   * The `?simulate=` failure modes are a development tool, disabled in
   * production — otherwise any visitor could order an error from the server.
   */
  allowSimulate: !isProduction,

  openRouter: {
    apiKey,
    baseUrl: text('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
    /** Pins the default model. Empty means "pick one from the live catalogue". */
    model: text('OPENROUTER_MODEL'),
    /**
     * OpenRouter attributes traffic by these and shows them on its dashboards.
     * Optional, and nothing breaks without them.
     */
    referer: text('OPENROUTER_REFERER'),
    title: text('OPENROUTER_TITLE', 'Har Kun'),
  },

  timeouts: {
    /** Free models can sit in a queue for a while. */
    firstTokenMs: num('TIMEOUT_FIRST_TOKEN_MS', 30_000),
    /** The stream has stalled — treat it as dead. */
    idleMs: num('TIMEOUT_IDLE_MS', 20_000),
    /** An upper bound on the whole request. */
    totalMs: num('TIMEOUT_TOTAL_MS', 120_000),
  },

  /** Against proxies that cut idle connections. */
  keepaliveMs: num('KEEPALIVE_MS', 15_000),
} as const

/**
 * Checked once, at boot, so a missing key is a server that does not start with
 * a legible complaint rather than one that looks healthy and fails on the first
 * question somebody asks.
 */
export function assertConfigured(): void {
  if (config.useMock) return

  if (config.openRouter.apiKey === '') {
    throw new Error(
      'OPENROUTER_API_KEY is empty and MOCK=0. Either set the key, or drop MOCK=0 to run on the mock.',
    )
  }
}
