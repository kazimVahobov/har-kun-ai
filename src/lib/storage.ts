import type { ApiError, ChatRole } from '../../shared/contract.js'
import type { Chat, ChatState, Message, MessageStatus } from './types.js'

/**
 * Persisting the conversation into `sessionStorage`.
 *
 * Storage exists for exactly one purpose: surviving a page reload. It is never
 * what the interface renders from — that reads memory — so writes can be
 * debounced instead of happening per token (ADR 0011).
 *
 * The `Storage` object is injected rather than reached for globally. That keeps
 * the module testable without a DOM, and lets a test make `setItem` throw, which
 * is the one failure path that actually matters here.
 */

export const STORAGE_KEY = 'har-kun-ai:v1'
export const STORAGE_VERSION = 1

/** Above this, the oldest chats are evicted. The active one is always kept. */
export const MAX_CHATS = 20

export const SAVE_DEBOUNCE_MS = 300

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** The terminal statuses. `streaming` never reaches storage. */
const STORED_STATUSES = ['done', 'stopped', 'error'] as const
type StoredStatus = (typeof STORED_STATUSES)[number]

interface StoredMessage {
  id: string
  role: ChatRole
  content: string
  status: StoredStatus
  error?: ApiError
  failedAt?: number
}

interface StoredChat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messages: StoredMessage[]
}

interface StoredState {
  version: number
  activeChatId: string
  chats: StoredChat[]
}

// ── Reading ──────────────────────────────────────────────────────────────────

/**
 * Returns `null` when there is nothing usable — the caller then starts fresh.
 *
 * Anything here may have been hand-edited or left by an older version, so the
 * shape is validated rather than trusted. An invalid chat is dropped on its own;
 * one broken entry should not cost the user every other conversation.
 */
export function loadState(storage: StorageLike): ChatState | null {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    // Private mode throws on access. Losing history is acceptable; crashing is not.
    return null
  }

  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed) || parsed['version'] !== STORAGE_VERSION) return null

  const rawChats = parsed['chats']
  if (!Array.isArray(rawChats)) return null

  const chats = rawChats.filter(isStoredChat).map(toChat)
  if (chats.length === 0) return null

  const activeChatId = parsed['activeChatId']
  const active =
    typeof activeChatId === 'string' && chats.some((chat) => chat.id === activeChatId)
      ? activeChatId
      : freshest(chats).id

  return { activeChatId: active, chats }
}

// ── Writing ──────────────────────────────────────────────────────────────────

/**
 * Best-effort by design: a failed write must not take the application with it.
 * On a quota error the oldest chat is dropped and the write is retried once.
 */
export function saveState(storage: StorageLike, state: ChatState): void {
  let chats = evict(state.chats, state.activeChatId)

  for (;;) {
    try {
      storage.setItem(STORAGE_KEY, serialize(state.activeChatId, chats))
      return
    } catch (error) {
      // Only a quota error is worth retrying; anything else will not be helped
      // by dropping data.
      if (!isQuotaError(error) || chats.length <= 1) return

      const oldest = freshest(chats, 'last')
      chats = chats.filter((chat) => chat.id !== oldest.id)
    }
  }
}

export function clearState(storage: StorageLike): void {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: the caller cannot act on this either.
  }
}

export interface StateSaver {
  /** Debounced. Safe to call on every state change, including per token. */
  schedule(state: ChatState): void
  /** Writes a pending state immediately — on a terminal event and on `pagehide`. */
  flush(): void
  cancel(): void
}

export function createStateSaver(
  storage: StorageLike,
  delayMs: number = SAVE_DEBOUNCE_MS,
): StateSaver {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: ChatState | undefined

  const write = (): void => {
    if (pending === undefined) return
    const state = pending
    pending = undefined
    saveState(storage, state)
  }

  return {
    schedule(state) {
      pending = state
      if (timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        write()
      }, delayMs)
    },
    flush() {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      write()
    },
    cancel() {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      pending = undefined
    },
  }
}

// ── Internals ────────────────────────────────────────────────────────────────

function serialize(activeChatId: string, chats: Chat[]): string {
  const stored: StoredState = {
    version: STORAGE_VERSION,
    activeChatId,
    chats: chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      model: chat.model,
      messages: chat.messages.map(toStoredMessage),
    })),
  }
  return JSON.stringify(stored)
}

/**
 * A message still streaming when the write happens is stored as `stopped`: the
 * stream cannot outlive the page, so that is what it will be on the way back.
 */
function toStoredMessage(message: Message): StoredMessage {
  const stored: StoredMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status === 'streaming' ? 'stopped' : message.status,
  }
  if (message.error !== undefined) stored.error = message.error
  // Without this the retry countdown would restart at its full length after a
  // reload, however long the wait had actually been.
  if (message.failedAt !== undefined) stored.failedAt = message.failedAt
  return stored
}

/** Keeps the freshest chats, and the active one regardless of its age. */
function evict(chats: Chat[], activeChatId: string): Chat[] {
  if (chats.length <= MAX_CHATS) return chats

  const byRecency = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const kept = new Set(byRecency.slice(0, MAX_CHATS).map((chat) => chat.id))
  kept.add(activeChatId)

  return chats.filter((chat) => kept.has(chat.id))
}

function freshest(chats: Chat[], which: 'first' | 'last' = 'first'): Chat {
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const chat = which === 'first' ? sorted[0] : sorted[sorted.length - 1]
  // Callers only reach this with a non-empty list; the fallback keeps the types
  // honest without an assertion.
  return chat ?? (chats[0] as Chat)
}

function isQuotaError(error: unknown): boolean {
  return error instanceof Error && /quota/i.test(error.name)
}

function toChat(stored: StoredChat): Chat {
  return {
    id: stored.id,
    title: stored.title,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    model: stored.model,
    messages: stored.messages.map((message) => {
      const result: Message = {
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status satisfies MessageStatus,
      }
      if (message.error !== undefined) result.error = message.error
      if (message.failedAt !== undefined) result.failedAt = message.failedAt
      return result
    }),
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStoredChat(value: unknown): value is StoredChat {
  if (!isRecord(value)) return false

  return (
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    Number.isFinite(value['createdAt']) &&
    Number.isFinite(value['updatedAt']) &&
    typeof value['model'] === 'string' &&
    Array.isArray(value['messages']) &&
    value['messages'].every(isStoredMessage)
  )
}

function isStoredMessage(value: unknown): value is StoredMessage {
  if (!isRecord(value)) return false

  const status = value['status']
  const error = value['error']
  const failedAt = value['failedAt']

  return (
    typeof value['id'] === 'string' &&
    (value['role'] === 'user' || value['role'] === 'assistant') &&
    typeof value['content'] === 'string' &&
    typeof status === 'string' &&
    (STORED_STATUSES as readonly string[]).includes(status) &&
    (error === undefined || isApiError(error)) &&
    (failedAt === undefined || Number.isFinite(failedAt))
  )
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value['code'] === 'string' && typeof value['message'] === 'string'
}
