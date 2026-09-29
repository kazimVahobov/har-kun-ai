import { describe, expect, it } from 'vitest'
import {
  activeChat,
  chatReducer,
  chatsByRecency,
  createInitialState,
  isStreaming,
  type ChatAction,
} from './chatReducer.js'
import type { ChatState, Message } from './types.js'

const MODEL = 'mock/lorem:free'

function start(): ChatState {
  return createInitialState('c1', MODEL, 1000)
}

function apply(state: ChatState, ...actions: ChatAction[]): ChatState {
  return actions.reduce(chatReducer, state)
}

/** Sending a message and starting generation — the prelude to nearly every test. */
function sent(state: ChatState, content = 'hello', chatId = 'c1', now = 2000): ChatState {
  return apply(state, {
    type: 'message/sent',
    chatId,
    userId: `${chatId}-u`,
    assistantId: `${chatId}-a`,
    content,
    now,
  })
}

function messages(state: ChatState, chatId = 'c1'): Message[] {
  return state.chats.find((chat) => chat.id === chatId)?.messages ?? []
}

function assistant(state: ChatState, chatId = 'c1'): Message | undefined {
  return messages(state, chatId)[1]
}

describe('sending a message', () => {
  it('appends the user message and an empty answer in streaming', () => {
    const state = sent(start())

    expect(messages(state)).toEqual([
      { id: 'c1-u', role: 'user', content: 'hello', status: 'done' },
      { id: 'c1-a', role: 'assistant', content: '', status: 'streaming' },
    ])
  })

  it('takes the chat title from the first message', () => {
    expect(activeChat(sent(start()))?.title).toBe('hello')
  })

  it('trims a long title on a word boundary', () => {
    const long = 'how cancelling generation works inside a streamed language model response'
    const title = activeChat(sent(start(), long))?.title ?? ''

    expect(title.length).toBeLessThanOrEqual(41)
    expect(title.endsWith('…')).toBe(true)
    expect(long.startsWith(title.slice(0, -1))).toBe(true)
  })

  it('does not let a second message rewrite the title', () => {
    const first = sent(start(), 'first')
    const second = apply(first, {
      type: 'message/sent',
      chatId: 'c1',
      userId: 'u2',
      assistantId: 'a2',
      content: 'second',
      now: 3000,
    })

    expect(activeChat(second)?.title).toBe('first')
  })
})

describe('accumulating the stream', () => {
  it('joins increments', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'Lorem ' },
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'ipsum' },
    )

    expect(assistant(state)?.content).toBe('Lorem ipsum')
  })

  it('does not move updatedAt on every token', () => {
    const before = sent(start())
    const after = apply(before, {
      type: 'stream/delta',
      chatId: 'c1',
      messageId: 'c1-a',
      text: 'a',
    })

    // Otherwise the chat would jump around the sidebar on every character.
    expect(activeChat(after)?.updatedAt).toBe(activeChat(before)?.updatedAt)
  })

  it('done moves the message to done and moves updatedAt', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'finished' },
      { type: 'stream/done', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    expect(assistant(state)?.status).toBe('done')
    expect(activeChat(state)?.updatedAt).toBe(5000)
  })
})

describe("a partial answer is never lost — the assignment's central invariant", () => {
  it('a stop mid-generation keeps the accumulated text', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'half an answer' },
      { type: 'stream/stopped', chatId: 'c1', messageId: 'c1-a', now: 4000 },
    )

    expect(assistant(state)).toMatchObject({ content: 'half an answer', status: 'stopped' })
  })

  it('an error after partial text keeps the text and attaches the error', () => {
    const error = { code: 'upstream_error' as const, message: 'Модель оборвала генерацию.' }
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'the start of an answer' },
      { type: 'stream/failed', chatId: 'c1', messageId: 'c1-a', error, now: 4000 },
    )

    expect(assistant(state)).toMatchObject({
      content: 'the start of an answer',
      status: 'error',
      error,
    })
  })

  it('stamps when the failure happened, so a wait can outlive a reload', () => {
    // retryAfter is a duration; on its own it would restart at full length
    // after a reload. Paired with this stamp it becomes a moment.
    const error = { code: 'rate_limited' as const, message: 'Занята', retryAfter: 30 }
    const state = apply(sent(start()), {
      type: 'stream/failed',
      chatId: 'c1',
      messageId: 'c1-a',
      error,
      now: 4000,
    })

    expect(assistant(state)?.failedAt).toBe(4000)
  })

  it('a late delta after a stop does not revive the text', () => {
    // Between abort and the socket closing, an event may already be on the wire.
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'a chunk' },
      { type: 'stream/stopped', chatId: 'c1', messageId: 'c1-a', now: 4000 },
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: ' arriving late' },
    )

    expect(assistant(state)?.content).toBe('a chunk')
    expect(assistant(state)?.status).toBe('stopped')
  })

  it('a second terminal event does not overwrite the first', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/stopped', chatId: 'c1', messageId: 'c1-a', now: 4000 },
      { type: 'stream/done', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    expect(assistant(state)?.status).toBe('stopped')
  })

  it('a retry clears both the text and the error', () => {
    const error = { code: 'timeout' as const, message: 'Модель не ответила.' }
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'a fragment' },
      { type: 'stream/failed', chatId: 'c1', messageId: 'c1-a', error, now: 4000 },
      { type: 'message/retried', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    expect(assistant(state)).toEqual({
      id: 'c1-a',
      role: 'assistant',
      content: '',
      status: 'streaming',
    })
  })
})

describe('several chats', () => {
  it('keeps accumulating generation in a background chat', () => {
    // Switching chats must not kill generation (ADR 0011).
    let state = sent(start())
    state = apply(state, { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })

    expect(state.activeChatId).toBe('c2')

    state = apply(state, {
      type: 'stream/delta',
      chatId: 'c1',
      messageId: 'c1-a',
      text: 'background text',
    })

    expect(assistant(state)?.content).toBe('background text')
    expect(state.activeChatId).toBe('c2')
  })

  it('isStreaming sees generation in an inactive chat', () => {
    const state = apply(sent(start()), {
      type: 'chat/created',
      chatId: 'c2',
      model: MODEL,
      now: 3000,
    })
    const background = state.chats.find((chat) => chat.id === 'c1')

    expect(background && isStreaming(background)).toBe(true)
  })

  it('remembers the model per chat rather than globally', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    state = apply(state, { type: 'chat/model-changed', chatId: 'c2', model: 'mock/lorem-slow:free' })

    expect(state.chats.find((chat) => chat.id === 'c1')?.model).toBe(MODEL)
    expect(state.chats.find((chat) => chat.id === 'c2')?.model).toBe('mock/lorem-slow:free')
  })

  it('sorts chats by recency', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    expect(chatsByRecency(state).map((chat) => chat.id)).toEqual(['c2', 'c1'])

    // A new message in the older chat lifts it to the top.
    state = sent(state, 'hello', 'c1', 4000)
    expect(chatsByRecency(state).map((chat) => chat.id)).toEqual(['c1', 'c2'])
  })
})

describe('deleting a chat', () => {
  it('deleting the active one switches to the freshest of the rest', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    state = apply(state, { type: 'chat/created', chatId: 'c3', model: MODEL, now: 4000 })
    state = apply(state, {
      type: 'chat/deleted',
      chatId: 'c3',
      newChatId: 'unused',
      model: MODEL,
      now: 5000,
    })

    expect(state.chats.map((chat) => chat.id)).toEqual(['c1', 'c2'])
    expect(state.activeChatId).toBe('c2')
  })

  it('deleting a background chat leaves the active one alone', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    state = apply(state, {
      type: 'chat/deleted',
      chatId: 'c1',
      newChatId: 'unused',
      model: MODEL,
      now: 5000,
    })

    expect(state.activeChatId).toBe('c2')
  })

  it('deleting the last one starts an empty chat', () => {
    const state = apply(sent(start()), {
      type: 'chat/deleted',
      chatId: 'c1',
      newChatId: 'fresh',
      model: MODEL,
      now: 5000,
    })

    expect(state.chats).toHaveLength(1)
    expect(state.activeChatId).toBe('fresh')
    expect(messages(state, 'fresh')).toEqual([])
  })
})

describe('restoring from storage', () => {
  it('turns an unfinished message into stopped and keeps the text', () => {
    // fetch died with the page — a typing indicator would be a lie.
    const stored = apply(sent(start()), {
      type: 'stream/delta',
      chatId: 'c1',
      messageId: 'c1-a',
      text: 'a fragment',
    })

    const restored = chatReducer(start(), { type: 'restored', state: stored })

    expect(assistant(restored)).toMatchObject({ content: 'a fragment', status: 'stopped' })
  })

  it('leaves finished messages alone', () => {
    const stored = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'whole' },
      { type: 'stream/done', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    const restored = chatReducer(start(), { type: 'restored', state: stored })

    expect(assistant(restored)?.status).toBe('done')
  })
})

describe('unknown targets break nothing', () => {
  it('an action for another chat returns the same state', () => {
    const state = sent(start())
    const after = apply(state, {
      type: 'stream/delta',
      chatId: 'no-such-chat',
      messageId: 'c1-a',
      text: 'x',
    })

    // The same reference: a pointless state object is a pointless render.
    expect(after).toBe(state)
  })

  it('an action for another message returns the same state', () => {
    const state = sent(start())
    const after = apply(state, {
      type: 'stream/done',
      chatId: 'c1',
      messageId: 'no-such-message',
      now: 5000,
    })

    expect(after).toBe(state)
  })

  it('selecting a chat that does not exist is ignored', () => {
    const state = sent(start())
    expect(apply(state, { type: 'chat/selected', chatId: 'no-such-chat' })).toBe(state)
  })
})
