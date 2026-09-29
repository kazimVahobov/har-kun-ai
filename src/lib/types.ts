import type { ApiError, ChatRole } from '../../shared/contract.js'

/**
 * `streaming` живёт только в памяти: в хранилище его нет. Восстановленное
 * из `sessionStorage` незавершённое сообщение становится `stopped` — поток
 * умер вместе со страницей, и показывать для него индикатор печати нельзя
 * (ADR 0011).
 */
export type MessageStatus = 'streaming' | 'done' | 'stopped' | 'error'

export interface Message {
  id: string
  role: ChatRole
  content: string
  status: MessageStatus
  error?: ApiError
}

export interface Chat {
  id: string
  /** Из первого сообщения пользователя; до него — пусто. */
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
