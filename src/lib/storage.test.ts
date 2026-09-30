import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_CHATS,
  STORAGE_KEY,
  STORAGE_VERSION,
  createStateSaver,
  loadState,
  saveState,
  type StorageLike,
} from './storage.js'
import type { Chat, ChatState, Message } from './types.js'

/**
 * An in-memory stand-in for `sessionStorage`, with a hook to make writes fail.
 * Cheaper than jsdom, and it can produce a quota error on demand — which is the
 * failure path worth testing.
 */
class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>()
  failWith: Error | undefined
  reads = 0
  writes = 0

  getItem(key: string): string | null {
    this.reads += 1
    if (this.failWith !== undefined) throw this.failWith
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.writes += 1
    if (this.failWith !== undefined) throw this.failWith
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

function quotaError(): Error {
  const error = new Error('quota exceeded')
  error.name = 'QuotaExceededError'
  return error
}

function message(over: Partial<Message> = {}): Message {
  return { id: 'm1', role: 'assistant', content: 'text', status: 'done', ...over }
}

function chat(over: Partial<Chat> = {}): Chat {
  return {
    id: 'c1',
    title: 'A chat',
    createdAt: 1000,
    updatedAt: 2000,
    model: 'mock/lorem:free',
    messages: [message()],
    ...over,
  }
}

function state(over: Partial<ChatState> = {}): ChatState {
  return { activeChatId: 'c1', chats: [chat()], ...over }
}

function roundTrip(input: ChatState): ChatState | null {
  const storage = new FakeStorage()
  saveState(storage, input)
  return loadState(storage)
}

describe('round trip', () => {
  it('restores what was saved', () => {
    expect(roundTrip(state())).toEqual(state())
  })

  it('carries the error along with the message', () => {
    const error = { code: 'rate_limited' as const, message: 'Модель занята', retryAfter: 12 }
    const input = state({ chats: [chat({ messages: [message({ status: 'error', error })] })] })

    expect(roundTrip(input)?.chats[0]?.messages[0]?.error).toEqual(error)
  })

  it('carries the failure stamp, so a retry wait survives a reload', () => {
    const error = { code: 'rate_limited' as const, message: 'Занята', retryAfter: 30 }
    const input = state({
      chats: [chat({ messages: [message({ status: 'error', error, failedAt: 1_700_000_000_000 })] })],
    })

    expect(roundTrip(input)?.chats[0]?.messages[0]?.failedAt).toBe(1_700_000_000_000)
  })

  it('drops a chat whose failure stamp is not a number', () => {
    const storage = new FakeStorage()
    storage.items.set(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        activeChatId: 'c1',
        chats: [{ ...chat(), messages: [{ ...message(), failedAt: 'вчера' }] }],
      }),
    )

    expect(loadState(storage)).toBeNull()
  })

  it('writes a streaming message as stopped', () => {
    // The stream cannot outlive the page, so that is what it will be on the way
    // back. Storing `streaming` would mean storing a state that cannot be true.
    const input = state({ chats: [chat({ messages: [message({ status: 'streaming' })] })] })

    expect(roundTrip(input)?.chats[0]?.messages[0]).toMatchObject({
      content: 'text',
      status: 'stopped',
    })
  })

  it('keeps several chats and the active one', () => {
    const input = state({
      activeChatId: 'c2',
      chats: [chat(), chat({ id: 'c2', updatedAt: 3000 })],
    })

    const restored = roundTrip(input)
    expect(restored?.chats.map((entry) => entry.id)).toEqual(['c1', 'c2'])
    expect(restored?.activeChatId).toBe('c2')
  })
})

describe('reading rubbish', () => {
  function load(raw: string): ChatState | null {
    const storage = new FakeStorage()
    storage.items.set(STORAGE_KEY, raw)
    return loadState(storage)
  }

  it('returns null when there is nothing stored', () => {
    expect(loadState(new FakeStorage())).toBeNull()
  })

  it('returns null on broken JSON', () => {
    expect(load('{"version":1,')).toBeNull()
  })

  it('returns null on another version', () => {
    expect(load(JSON.stringify({ version: 99, activeChatId: 'c1', chats: [] }))).toBeNull()
  })

  it('returns null when reading throws', () => {
    // Private mode throws on access. Losing history is acceptable; crashing is not.
    const storage = new FakeStorage()
    storage.failWith = new Error('access denied')

    expect(loadState(storage)).toBeNull()
  })

  it('drops an invalid chat and keeps the rest', () => {
    // One broken entry should not cost the user every other conversation.
    const good = { ...chat({ id: 'good' }), messages: [message()] }
    const raw = JSON.stringify({
      version: STORAGE_VERSION,
      activeChatId: 'good',
      chats: [{ id: 'broken', title: 42 }, good],
    })

    const restored = load(raw)
    expect(restored?.chats.map((entry) => entry.id)).toEqual(['good'])
  })

  it('drops a chat holding a message with an unknown status', () => {
    const raw = JSON.stringify({
      version: STORAGE_VERSION,
      activeChatId: 'c1',
      chats: [{ ...chat(), messages: [{ ...message(), status: 'streaming' }] }],
    })

    expect(load(raw)).toBeNull()
  })

  it('falls back to the freshest chat when activeChatId points nowhere', () => {
    const raw = JSON.stringify({
      version: STORAGE_VERSION,
      activeChatId: 'deleted',
      chats: [chat({ id: 'old', updatedAt: 1000 }), chat({ id: 'new', updatedAt: 5000 })],
    })

    expect(load(raw)?.activeChatId).toBe('new')
  })
})

describe('writing failures', () => {
  it('drops the oldest chat and retries once on a quota error', () => {
    const storage = new FakeStorage()
    let attempts = 0
    const original = storage.setItem.bind(storage)
    storage.setItem = (key, value) => {
      attempts += 1
      if (attempts === 1) throw quotaError()
      original(key, value)
    }

    saveState(storage, {
      activeChatId: 'new',
      chats: [chat({ id: 'old', updatedAt: 1000 }), chat({ id: 'new', updatedAt: 5000 })],
    })

    expect(attempts).toBe(2)
    expect(loadState(storage)?.chats.map((entry) => entry.id)).toEqual(['new'])
  })

  it('gives up on a non-quota error instead of dropping data', () => {
    // Dropping a conversation would not help an unrelated failure.
    const storage = new FakeStorage()
    storage.failWith = new Error('something else')

    expect(() => saveState(storage, state())).not.toThrow()
    expect(storage.writes).toBe(1)
  })

  it('does not throw when nothing can be written at all', () => {
    const storage = new FakeStorage()
    storage.failWith = quotaError()

    expect(() => saveState(storage, state())).not.toThrow()
  })
})

describe('eviction', () => {
  function manyChats(count: number): Chat[] {
    return Array.from({ length: count }, (_, index) =>
      chat({ id: `c${index}`, updatedAt: 1000 + index }),
    )
  }

  it(`keeps at most ${MAX_CHATS} chats, freshest first`, () => {
    const chats = manyChats(MAX_CHATS + 5)
    const restored = roundTrip({ activeChatId: chats[chats.length - 1]!.id, chats })

    expect(restored?.chats).toHaveLength(MAX_CHATS)
    expect(restored?.chats.map((entry) => entry.id)).not.toContain('c0')
  })

  it('keeps the active chat even when it is the oldest', () => {
    // Evicting what the user is looking at would be worse than storing one extra.
    const chats = manyChats(MAX_CHATS + 5)
    const restored = roundTrip({ activeChatId: 'c0', chats })

    expect(restored?.chats.map((entry) => entry.id)).toContain('c0')
    expect(restored?.activeChatId).toBe('c0')
  })

  it('does not touch anything below the limit', () => {
    const chats = manyChats(3)
    expect(roundTrip({ activeChatId: 'c0', chats })?.chats).toHaveLength(3)
  })
})

describe('debounced saver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes once for a burst of changes', () => {
    // This is what makes per-token persistence unnecessary: rendering reads
    // memory, so storage only has to keep up with the last state (ADR 0011).
    const storage = new FakeStorage()
    const saver = createStateSaver(storage, 300)

    for (let index = 0; index < 50; index += 1) {
      saver.schedule(state({ chats: [chat({ title: `title ${index}` })] }))
    }
    expect(storage.writes).toBe(0)

    vi.advanceTimersByTime(300)

    expect(storage.writes).toBe(1)
    expect(loadState(storage)?.chats[0]?.title).toBe('title 49')
  })

  it('flush writes immediately and cancels the pending timer', () => {
    const storage = new FakeStorage()
    const saver = createStateSaver(storage, 300)

    saver.schedule(state())
    saver.flush()

    expect(storage.writes).toBe(1)

    vi.advanceTimersByTime(300)
    expect(storage.writes).toBe(1)
  })

  it('flush with nothing pending writes nothing', () => {
    const storage = new FakeStorage()
    createStateSaver(storage, 300).flush()

    expect(storage.writes).toBe(0)
  })

  it('starts a new window after the previous write', () => {
    const storage = new FakeStorage()
    const saver = createStateSaver(storage, 300)

    saver.schedule(state({ chats: [chat({ title: 'first' })] }))
    vi.advanceTimersByTime(300)

    saver.schedule(state({ chats: [chat({ title: 'second' })] }))
    vi.advanceTimersByTime(300)

    expect(storage.writes).toBe(2)
    expect(loadState(storage)?.chats[0]?.title).toBe('second')
  })
})

