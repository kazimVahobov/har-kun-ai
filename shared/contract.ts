/**
 * Контракт между браузером и сервером. Общий для мок-сервера и будущего
 * адаптера OpenRouter — правится вместе с обеими реализациями и с docs/plan.md.
 */

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  /** Необязательна: без неё берётся модель по умолчанию. */
  model?: string
}

export type ErrorCode =
  | 'bad_request'
  | 'rate_limited'
  | 'upstream_error'
  | 'upstream_unavailable'
  | 'timeout'
  | 'internal'

export interface ApiError {
  code: ErrorCode
  message: string
  /** Секунды до повторной попытки, если апстрим их сообщил. */
  retryAfter?: number
}

/** Статус, с которым ошибка уходит, если поток ещё не начался. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  rate_limited: 429,
  upstream_error: 502,
  upstream_unavailable: 503,
  timeout: 504,
  internal: 500,
}

/** Тело ошибки до начала потока. После начала — событие `error`. */
export interface ErrorResponse {
  error: ApiError
}

export type DoneReason = 'stop' | 'length'

/** Приращение текста, не накопленный текст: клиент склеивает сам. */
export interface DeltaEvent {
  text: string
}

export interface DoneEvent {
  reason: DoneReason
  model: string
  chars: number
}

export type StreamEvent =
  | { event: 'delta'; data: DeltaEvent }
  | { event: 'done'; data: DoneEvent }
  | { event: 'error'; data: ApiError }

export interface ModelInfo {
  id: string
  name: string
  contextLength: number
}

export interface ModelsResponse {
  models: ModelInfo[]
  default: string
}

/** Режимы отказов мок-сервера. Работают только вне продакшена. */
export const SIMULATE_MODES = ['429', 'timeout', 'drop', 'mid-error', 'slow'] as const
export type SimulateMode = (typeof SIMULATE_MODES)[number]

export function isSimulateMode(value: unknown): value is SimulateMode {
  return typeof value === 'string' && (SIMULATE_MODES as readonly string[]).includes(value)
}
