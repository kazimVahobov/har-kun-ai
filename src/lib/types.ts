import type { ApiError, ChatRole } from '../../shared/contract.js'

/**
 * `streaming` lives only in memory; it never reaches storage. An unfinished
 * message restored from `sessionStorage` becomes `stopped` — the stream died
 * with the page, and showing a typing indicator for it would be a lie
 * (ADR 0011).
 */
export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error'

export interface Message {
  id: string
  role: ChatRole
  content: string
  status: MessageStatus
  error?: ApiError
  /**
   * When the failure happened, in epoch milliseconds. The contract's
   * `retryAfter` is a duration, and a duration alone cannot survive a reload —
   * the wait would start over. Paired with this it becomes a moment.
   */
  failedAt?: number
}

export interface Chat {
  id: string
  /** From the first user message; empty until there is one. */
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messages: Message[]
}

export interface ChatState {
  activeChatId: string
  chats: Chat[]
}
