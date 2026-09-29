function num(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} должен быть положительным числом, получено: ${raw}`)
  }
  return parsed
}

const isProduction = process.env.NODE_ENV === 'production'

export const config = {
  port: num('PORT', 8787),
  isProduction,

  /**
   * Мок включён, пока явно не выключен. Живого адаптера ещё нет — он появится
   * в фазе 3 (ADR 0003); до тех пор MOCK=0 честно отвечает upstream_unavailable.
   */
  useMock: process.env.MOCK !== '0',

  /**
   * Режимы отказов `?simulate=` — инструмент разработки, в проде выключены,
   * иначе любой посетитель мог бы заказать серверу ошибку.
   */
  allowSimulate: !isProduction,

  timeouts: {
    /** Бесплатные модели могут долго стоять в очереди. */
    firstTokenMs: num('TIMEOUT_FIRST_TOKEN_MS', 30_000),
    /** Поток замер — считаем мёртвым. */
    idleMs: num('TIMEOUT_IDLE_MS', 20_000),
    /** Верхняя граница на запрос целиком. */
    totalMs: num('TIMEOUT_TOTAL_MS', 120_000),
  },

  /** Против прокси, режущих простаивающие соединения. */
  keepaliveMs: num('KEEPALIVE_MS', 15_000),
} as const
