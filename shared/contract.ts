/**
 * The contract between the browser and the server. Shared by the mock server and
 * the OpenRouter adapter to come — changed together with both implementations
 * and with docs/plan.md.
 *
 * Note that `message` fields carry text meant for display, so they are written
 * in Russian. See the language rule in CLAUDE.md.
 */

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  /** Optional: without it the server's default model is used. */
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
  /** Seconds until a retry makes sense, when the upstream said so. */
  retryAfter?: number
}

/** The status an error carries when the stream has not started yet. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  rate_limited: 429,
  upstream_error: 502,
  upstream_unavailable: 503,
  timeout: 504,
  internal: 500,
}

/** The error body before the stream starts. Afterwards it is an `error` event. */
export interface ErrorResponse {
  error: ApiError
}

export type DoneReason = 'stop' | 'length'

/** An increment, not the accumulated text: the client joins it itself. */
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

/** The mock server's failure modes. Only active outside production. */
export const SIMULATE_MODES = ['429', 'timeout', 'drop', 'mid-error', 'slow'] as const
export type SimulateMode = (typeof SIMULATE_MODES)[number]

export function isSimulateMode(value: unknown): value is SimulateMode {
  return typeof value === 'string' && (SIMULATE_MODES as readonly string[]).includes(value)
}
