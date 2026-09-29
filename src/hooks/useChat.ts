import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ChatMessage, ModelInfo, ModelsResponse } from '../../shared/contract.js'
import {
  activeChat as selectActiveChat,
  chatReducer,
  createInitialState,
  isStreaming as chatIsStreaming,
} from '../lib/chatReducer.js'
import { CHAT_ENDPOINT, runChatStream } from '../lib/chatStream.js'
import { createStateSaver, loadState } from '../lib/storage.js'
import { createStreamRegistry } from '../lib/streams.js'
import type { Chat, ChatState, Message } from '../lib/types.js'

/**
 * Wiring the pure pieces together: the reducer holds the state, the registry
 * holds the running generations, the saver persists. Everything impure that the
 * reducer refuses to do — the clock, id generation, `fetch` — happens here.
 */

export interface UseChat {
  chat: Chat
  models: ModelInfo[]
  /** The chat's model, or the server's default when it names one we do not know. */
  model: string
  isStreaming: boolean
  send(content: string): void
  stop(): void
  retry(): void
  setModel(model: string): void
}

export function useChat(): UseChat {
  const [state, dispatch] = useReducer(chatReducer, undefined, initialState)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [defaultModel, setDefaultModel] = useState('')

  const registry = useRef(createStreamRegistry())
  const saver = useRef<ReturnType<typeof createStateSaver>>(undefined)
  saver.current ??= createStateSaver(sessionStorage)

  const chat = selectActiveChat(state) ?? state.chats[0]
  if (chat === undefined) throw new Error('Chat state must always hold at least one chat')

  const isStreaming = chatIsStreaming(chat)

  /**
   * A model the chat remembers may no longer exist — the catalogue changes, and
   * so does the mock. Falling back keeps the picker controlled and keeps the
   * server from rejecting a stale id.
   */
  const model = useMemo(
    () => (models.some((entry) => entry.id === chat.model) ? chat.model : defaultModel),
    [models, chat.model, defaultModel],
  )

  // While a stream runs, writes are debounced; once nothing is streaming the
  // pending state goes out immediately. Storage only has to survive a reload,
  // so it never needs to keep up per token (ADR 0011).
  useEffect(() => {
    const pending = saver.current
    if (pending === undefined) return

    pending.schedule(state)
    if (!state.chats.some(chatIsStreaming)) pending.flush()
  }, [state])

  // Closing the tab mid-stream would otherwise lose up to one debounce of text.
  useEffect(() => {
    const flush = (): void => saver.current?.flush()
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    void fetch('/api/models', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<ModelsResponse>) : null))
      .then((body) => {
        if (body === null) return
        setModels(body.models)
        setDefaultModel(body.default)
      })
      .catch(() => {
        // The picker stays empty and the server falls back to its own default.
      })

    return () => controller.abort()
  }, [])

  // Every generation is aborted when the app goes away, so nothing keeps
  // burning quota for a page that is no longer there.
  const streams = registry.current
  useEffect(() => () => streams.abortAll(), [streams])

  const startStream = useCallback(
    (chatId: string, messageId: string, history: ChatMessage[], requestedModel: string) => {
      const controller = streams.register(chatId)

      void runChatStream({
        request:
          requestedModel === ''
            ? { messages: history }
            : { messages: history, model: requestedModel },
        signal: controller.signal,
        endpoint: chatEndpoint(),
        handlers: {
          onDelta: (text) => dispatch({ type: 'stream/delta', chatId, messageId, text }),
          onDone: () => {
            streams.finish(chatId)
            dispatch({ type: 'stream/done', chatId, messageId, now: Date.now() })
          },
          onStopped: () => {
            streams.finish(chatId)
            dispatch({ type: 'stream/stopped', chatId, messageId, now: Date.now() })
          },
          onError: (error) => {
            streams.finish(chatId)
            dispatch({ type: 'stream/failed', chatId, messageId, error, now: Date.now() })
          },
        },
      })
    },
    [streams],
  )

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (trimmed === '' || isStreaming) return

      const assistantId = newId()
      const history = [...asHistory(chat.messages), { role: 'user' as const, content: trimmed }]

      dispatch({
        type: 'message/sent',
        chatId: chat.id,
        userId: newId(),
        assistantId,
        content: trimmed,
        now: Date.now(),
      })

      startStream(chat.id, assistantId, history, model)
    },
    [chat, isStreaming, model, startStream],
  )

  const stop = useCallback(() => {
    // Only the active chat. A generation running in another one is not ours to
    // cancel from here (ADR 0011).
    streams.abort(chat.id)
  }, [chat.id, streams])

  const retry = useCallback(() => {
    const last = chat.messages[chat.messages.length - 1]
    if (last === undefined || last.role !== 'assistant' || last.status === 'streaming') return

    // The history is what came before the failed answer — the answer itself,
    // partial or empty, is not context for its own retry.
    const history = asHistory(chat.messages.slice(0, -1))
    if (history.length === 0) return

    dispatch({ type: 'message/retried', chatId: chat.id, messageId: last.id, now: Date.now() })
    startStream(chat.id, last.id, history, model)
  }, [chat, model, startStream])

  const setModel = useCallback(
    (next: string) => dispatch({ type: 'chat/model-changed', chatId: chat.id, model: next }),
    [chat.id],
  )

  return { chat, models, model, isStreaming, send, stop, retry, setModel }
}

function initialState(): ChatState {
  const fresh = createInitialState(newId(), '', Date.now())
  const stored = loadState(sessionStorage)

  // Restoring goes through the reducer so the `streaming` → `stopped`
  // normalisation applies whatever the state's origin.
  return stored === null ? fresh : chatReducer(fresh, { type: 'restored', state: stored })
}

/**
 * Empty messages are dropped: an assistant entry with no text is either the
 * placeholder for the answer being generated right now or one that failed
 * before producing anything. Neither is context.
 */
function asHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter((message) => message.content !== '')
    .map((message) => ({ role: message.role, content: message.content }))
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * A development affordance: `?simulate=` on the page is forwarded to the API,
 * so the mock's failure modes — 429, a mid-stream error, a dropped connection —
 * can be exercised through the interface rather than only with curl. The server
 * ignores the parameter outside development, so this is inert in production.
 */
function chatEndpoint(): string {
  const simulate = new URLSearchParams(window.location.search).get('simulate')
  if (simulate === null) return CHAT_ENDPOINT

  return `${CHAT_ENDPOINT}?simulate=${encodeURIComponent(simulate)}`
}
