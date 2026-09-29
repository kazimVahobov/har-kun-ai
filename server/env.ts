function num(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number, got: ${raw}`)
  }
  return parsed
}

const isProduction = process.env.NODE_ENV === 'production'

export const config = {
  port: num('PORT', 8787),
  isProduction,

  /**
   * The mock is on until explicitly turned off. There is no live adapter yet —
   * it arrives in phase 3 (ADR 0003); until then MOCK=0 honestly answers
   * upstream_unavailable.
   */
  useMock: process.env.MOCK !== '0',

  /**
   * The `?simulate=` failure modes are a development tool, disabled in
   * production — otherwise any visitor could order an error from the server.
   */
  allowSimulate: !isProduction,

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
