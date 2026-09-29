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

/** Отправка сообщения и начало генерации — приставка почти ко всем тестам. */
function sent(state: ChatState, content = 'привет', chatId = 'c1', now = 2000): ChatState {
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

describe('отправка сообщения', () => {
  it('добавляет сообщение пользователя и пустой ответ в статусе streaming', () => {
    const state = sent(start())

    expect(messages(state)).toEqual([
      { id: 'c1-u', role: 'user', content: 'привет', status: 'done' },
      { id: 'c1-a', role: 'assistant', content: '', status: 'streaming' },
    ])
  })

  it('берёт заголовок чата из первого сообщения', () => {
    expect(activeChat(sent(start()))?.title).toBe('привет')
  })

  it('обрезает длинный заголовок по границе слова', () => {
    const long = 'как устроена отмена генерации в потоковом ответе языковой модели'
    const title = activeChat(sent(start(), long))?.title ?? ''

    expect(title.length).toBeLessThanOrEqual(41)
    expect(title.endsWith('…')).toBe(true)
    expect(long.startsWith(title.slice(0, -1))).toBe(true)
  })

  it('не переписывает заголовок вторым сообщением', () => {
    const first = sent(start(), 'первое')
    const second = apply(first, {
      type: 'message/sent',
      chatId: 'c1',
      userId: 'u2',
      assistantId: 'a2',
      content: 'второе',
      now: 3000,
    })

    expect(activeChat(second)?.title).toBe('первое')
  })
})

describe('накопление потока', () => {
  it('склеивает приращения', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'Lorem ' },
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'ipsum' },
    )

    expect(assistant(state)?.content).toBe('Lorem ipsum')
  })

  it('не двигает updatedAt на каждом токене', () => {
    const before = sent(start())
    const after = apply(before, {
      type: 'stream/delta',
      chatId: 'c1',
      messageId: 'c1-a',
      text: 'a',
    })

    // Иначе чат прыгал бы в сайдбаре на каждом символе.
    expect(activeChat(after)?.updatedAt).toBe(activeChat(before)?.updatedAt)
  })

  it('done переводит в done и двигает updatedAt', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'готово' },
      { type: 'stream/done', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    expect(assistant(state)?.status).toBe('done')
    expect(activeChat(state)?.updatedAt).toBe(5000)
  })
})

describe('частичный ответ не теряется — главный инвариант задания', () => {
  it('стоп посреди генерации сохраняет накопленный текст', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'Половина ответа' },
      { type: 'stream/stopped', chatId: 'c1', messageId: 'c1-a', now: 4000 },
    )

    expect(assistant(state)).toMatchObject({ content: 'Половина ответа', status: 'stopped' })
  })

  it('ошибка после частичного текста сохраняет текст и прикладывает ошибку', () => {
    const error = { code: 'upstream_error' as const, message: 'Модель оборвала генерацию.' }
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'Начало ответа' },
      { type: 'stream/failed', chatId: 'c1', messageId: 'c1-a', error, now: 4000 },
    )

    expect(assistant(state)).toMatchObject({ content: 'Начало ответа', status: 'error', error })
  })

  it('поздняя delta после остановки не оживляет текст', () => {
    // Между abort и закрытием сокета событие уже могло уйти в сеть.
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'кусок' },
      { type: 'stream/stopped', chatId: 'c1', messageId: 'c1-a', now: 4000 },
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: ' опоздавший' },
    )

    expect(assistant(state)?.content).toBe('кусок')
    expect(assistant(state)?.status).toBe('stopped')
  })

  it('второе терминальное событие не переписывает первое', () => {
    const state = apply(
      sent(start()),
      { type: 'stream/stopped', chatId: 'c1', messageId: 'c1-a', now: 4000 },
      { type: 'stream/done', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    expect(assistant(state)?.status).toBe('stopped')
  })

  it('повтор очищает и текст, и ошибку', () => {
    const error = { code: 'timeout' as const, message: 'Модель не ответила.' }
    const state = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'обрывок' },
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

describe('несколько чатов', () => {
  it('генерация в фоновом чате продолжает копиться', () => {
    // Переключение чата не должно ронять генерацию (ADR 0011).
    let state = sent(start())
    state = apply(state, { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })

    expect(state.activeChatId).toBe('c2')

    state = apply(state, {
      type: 'stream/delta',
      chatId: 'c1',
      messageId: 'c1-a',
      text: 'фоновый текст',
    })

    expect(assistant(state)?.content).toBe('фоновый текст')
    expect(state.activeChatId).toBe('c2')
  })

  it('isStreaming видит генерацию в неактивном чате', () => {
    const state = apply(sent(start()), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    const background = state.chats.find((chat) => chat.id === 'c1')

    expect(background && isStreaming(background)).toBe(true)
  })

  it('модель запоминается у чата, а не глобально', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    state = apply(state, { type: 'chat/model-changed', chatId: 'c2', model: 'mock/lorem-slow:free' })

    expect(state.chats.find((chat) => chat.id === 'c1')?.model).toBe(MODEL)
    expect(state.chats.find((chat) => chat.id === 'c2')?.model).toBe('mock/lorem-slow:free')
  })

  it('сортирует чаты по свежести', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    expect(chatsByRecency(state).map((chat) => chat.id)).toEqual(['c2', 'c1'])

    // Написали в старый чат — он поднимается наверх.
    state = sent(state, 'привет', 'c1', 4000)
    expect(chatsByRecency(state).map((chat) => chat.id)).toEqual(['c1', 'c2'])
  })
})

describe('удаление чата', () => {
  it('удаление активного переключает на самый свежий из оставшихся', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    state = apply(state, { type: 'chat/created', chatId: 'c3', model: MODEL, now: 4000 })
    state = apply(state, {
      type: 'chat/deleted',
      chatId: 'c3',
      newChatId: 'nope',
      model: MODEL,
      now: 5000,
    })

    expect(state.chats.map((chat) => chat.id)).toEqual(['c1', 'c2'])
    expect(state.activeChatId).toBe('c2')
  })

  it('удаление фонового не трогает активный', () => {
    let state = apply(start(), { type: 'chat/created', chatId: 'c2', model: MODEL, now: 3000 })
    state = apply(state, {
      type: 'chat/deleted',
      chatId: 'c1',
      newChatId: 'nope',
      model: MODEL,
      now: 5000,
    })

    expect(state.activeChatId).toBe('c2')
  })

  it('удаление последнего заводит пустой чат', () => {
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

describe('восстановление из хранилища', () => {
  it('незавершённое сообщение становится stopped, текст остаётся', () => {
    // fetch умер вместе со страницей — показывать индикатор печати нельзя.
    const stored = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'обрывок' },
    )

    const restored = chatReducer(start(), { type: 'restored', state: stored })

    expect(assistant(restored)).toMatchObject({ content: 'обрывок', status: 'stopped' })
  })

  it('завершённые сообщения не трогает', () => {
    const stored = apply(
      sent(start()),
      { type: 'stream/delta', chatId: 'c1', messageId: 'c1-a', text: 'целый' },
      { type: 'stream/done', chatId: 'c1', messageId: 'c1-a', now: 5000 },
    )

    const restored = chatReducer(start(), { type: 'restored', state: stored })

    expect(assistant(restored)?.status).toBe('done')
  })
})

describe('неизвестные цели ничего не ломают', () => {
  it('действие по чужому чату возвращает то же состояние', () => {
    const state = sent(start())
    const after = apply(state, {
      type: 'stream/delta',
      chatId: 'нет-такого',
      messageId: 'c1-a',
      text: 'x',
    })

    // Та же ссылка: лишний объект состояния — лишний рендер.
    expect(after).toBe(state)
  })

  it('действие по чужому сообщению возвращает то же состояние', () => {
    const state = sent(start())
    const after = apply(state, {
      type: 'stream/done',
      chatId: 'c1',
      messageId: 'нет-такого',
      now: 5000,
    })

    expect(after).toBe(state)
  })

  it('выбор несуществующего чата игнорируется', () => {
    const state = sent(start())
    expect(apply(state, { type: 'chat/selected', chatId: 'нет-такого' })).toBe(state)
  })
})
