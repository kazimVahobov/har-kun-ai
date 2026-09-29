import type { ApiError } from '../../shared/contract.js'
import type { Chat, ChatState, Message } from './types.js'

/**
 * Conversation state as a pure function.
 *
 * No `Date.now()` and no id generation inside: both arrive in the action.
 * Otherwise the reducer cannot be checked without faking time — and it has to
 * be checked, because the assignment's central invariant lives here: **the
 * chunk already received is never lost**, however generation ends.
 */

export const TITLE_LIMIT = 40

export type ChatAction =
  | { type: 'restored'; state: ChatState }
  | { type: 'chat/created'; chatId: string; model: string; now: number }
  | { type: 'chat/selected'; chatId: string }
  | { type: 'chat/deleted'; chatId: string; newChatId: string; model: string; now: number }
  | { type: 'chat/model-changed'; chatId: string; model: string }
  | {
      type: 'message/sent'
      chatId: string
      userId: string
      assistantId: string
      content: string
      now: number
    }
  | { type: 'message/retried'; chatId: string; messageId: string; now: number }
  | { type: 'stream/delta'; chatId: string; messageId: string; text: string }
  | { type: 'stream/done'; chatId: string; messageId: string; now: number }
  | { type: 'stream/stopped'; chatId: string; messageId: string; now: number }
  | { type: 'stream/failed'; chatId: string; messageId: string; error: ApiError; now: number }

export function createChat(id: string, model: string, now: number): Chat {
  return { id, title: '', createdAt: now, updatedAt: now, model, messages: [] }
}

export function createInitialState(chatId: string, model: string, now: number): ChatState {
  return { activeChatId: chatId, chats: [createChat(chatId, model, now)] }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'restored':
      return normalize(action.state)

    case 'chat/created': {
      const chat = createChat(action.chatId, action.model, action.now)
      return { activeChatId: chat.id, chats: [...state.chats, chat] }
    }

    case 'chat/selected':
      if (!state.chats.some((chat) => chat.id === action.chatId)) return state
      return { ...state, activeChatId: action.chatId }

    case 'chat/deleted': {
      const rest = state.chats.filter((chat) => chat.id !== action.chatId)

      // The last one is gone, so start a fresh empty chat: an interface with no
      // chat at all has no state it can be rendered in.
      if (rest.length === 0) {
        return createInitialState(action.newChatId, action.model, action.now)
      }

      if (state.activeChatId !== action.chatId) return { ...state, chats: rest }

      const next = [...rest].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      return { activeChatId: next?.id ?? action.newChatId, chats: rest }
    }

    case 'chat/model-changed':
      // The model is remembered per chat, not globally.
      return updateChat(state, action.chatId, (chat) => ({ ...chat, model: action.model }))

    case 'message/sent':
      return updateChat(state, action.chatId, (chat) => ({
        ...chat,
        title: chat.title === '' ? titleFrom(action.content) : chat.title,
        updatedAt: action.now,
        messages: [
          ...chat.messages,
          { id: action.userId, role: 'user', content: action.content, status: 'done' },
          { id: action.assistantId, role: 'assistant', content: '', status: 'streaming' },
        ],
      }))

    case 'message/retried':
      // Rebuilt rather than edited: that guarantees both the previous text and
      // the previous error are gone.
      return updateMessage(
        state,
        action.chatId,
        action.messageId,
        (message) => ({ id: message.id, role: message.role, content: '', status: 'streaming' }),
        action.now,
      )

    case 'stream/delta':
      return updateMessage(state, action.chatId, action.messageId, (message) => {
        // A late `delta` after a stop is not hypothetical: between `abort` and
        // the socket closing, an event may already be in flight. Appending to a
        // finished message would make the text come back to life after Stop.
        if (message.status !== 'streaming') return message
        return { ...message, content: message.content + action.text }
      })

    case 'stream/done':
      return finish(state, action.chatId, action.messageId, action.now, (message) => ({
        ...message,
        status: 'done',
      }))

    case 'stream/stopped':
      return finish(state, action.chatId, action.messageId, action.now, (message) => ({
        ...message,
        // content is untouched — that is the whole point of the Stop requirement.
        status: 'stopped',
      }))

    case 'stream/failed':
      return finish(state, action.chatId, action.messageId, action.now, (message) => ({
        ...message,
        status: 'error',
        error: action.error,
        failedAt: action.now,
      }))
  }
}

// ── Selectors ────────────────────────────────────────────────────────────────

export function activeChat(state: ChatState): Chat | undefined {
  return state.chats.find((chat) => chat.id === state.activeChatId)
}

export function findChat(state: ChatState, chatId: string): Chat | undefined {
  return state.chats.find((chat) => chat.id === chatId)
}

export function isStreaming(chat: Chat): boolean {
  return chat.messages.some((message) => message.status === 'streaming')
}

/** For the sidebar: freshest first. */
export function chatsByRecency(state: ChatState): Chat[] {
  return [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function streamingMessage(chat: Chat): Message | undefined {
  return chat.messages.find((message) => message.status === 'streaming')
}

// ── Internals ────────────────────────────────────────────────────────────────

function titleFrom(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= TITLE_LIMIT) return flat

  const cut = flat.lastIndexOf(' ', TITLE_LIMIT)
  return `${flat.slice(0, cut > TITLE_LIMIT / 2 ? cut : TITLE_LIMIT).trimEnd()}…`
}

/** A restored stream cannot have survived: the page took `fetch` with it. */
function normalize(state: ChatState): ChatState {
  return {
    ...state,
    chats: state.chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.status === 'streaming' ? { ...message, status: 'stopped' as const } : message,
      ),
    })),
  }
}

function updateChat(
  state: ChatState,
  chatId: string,
  update: (chat: Chat) => Chat,
): ChatState {
  const index = state.chats.findIndex((chat) => chat.id === chatId)
  const current = state.chats[index]
  // The same state object when there is nothing to change: a new reference is a wasted render.
  if (current === undefined) return state

  const updated = update(current)
  if (updated === current) return state

  const chats = [...state.chats]
  chats[index] = updated
  return { ...state, chats }
}

function updateMessage(
  state: ChatState,
  chatId: string,
  messageId: string,
  update: (message: Message) => Message,
  now?: number,
): ChatState {
  return updateChat(state, chatId, (chat) => {
    const index = chat.messages.findIndex((message) => message.id === messageId)
    const current = chat.messages[index]
    if (current === undefined) return chat

    const updated = update(current)
    if (updated === current) return chat

    const messages = [...chat.messages]
    messages[index] = updated
    return now === undefined ? { ...chat, messages } : { ...chat, messages, updatedAt: now }
  })
}

/**
 * A terminal event moves `updatedAt`; a `delta` does not, or the chat would jump
 * around the sidebar on every token.
 */
function finish(
  state: ChatState,
  chatId: string,
  messageId: string,
  now: number,
  update: (message: Message) => Message,
): ChatState {
  return updateMessage(
    state,
    chatId,
    messageId,
    (message) => (message.status === 'streaming' ? update(message) : message),
    now,
  )
}
