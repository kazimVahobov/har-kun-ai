import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useChat } from './hooks/useChat.js'
import type { Message } from './lib/types.js'

/**
 * The bare chat: correct semantics and behaviour, no styling at all. Nocturne's
 * tokens are a separate step, and mixing them in here would hide whether the
 * markup stands up on its own.
 */
export function App() {
  const { chat, models, model, isStreaming, send, stop, retry, setModel } = useChat()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Esc stops generation, from anywhere on the page. It lives here rather than
  // in the hook because once the sidebar exists, Esc has to close that first.
  useEffect(() => {
    if (!isStreaming) return

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') stop()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStreaming, stop])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (isStreaming) return

    send(draft)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (isStreaming) return

    send(draft)
    setDraft('')
  }

  const lastMessage = chat.messages[chat.messages.length - 1]
  const canRetry =
    lastMessage?.role === 'assistant' &&
    (lastMessage.status === 'error' || lastMessage.status === 'stopped')

  return (
    <>
      <header>
        <h1>har kun ai</h1>
      </header>

      <main>
        {chat.messages.length === 0 ? (
          <section aria-labelledby="empty-title">
            <h2 id="empty-title">Спросите что-нибудь</h2>
            <p>«har kun» по-узбекски — «каждый день». Модель отвечает потоком, ответ можно прервать.</p>
          </section>
        ) : (
          <ol>
            {chat.messages.map((message) => (
              <li key={message.id}>
                <MessageView message={message} />
              </li>
            ))}
          </ol>
        )}

        <p role="status" aria-live="polite">
          {statusText(isStreaming, lastMessage)}
        </p>

        {canRetry && (
          <button type="button" onClick={retry}>
            Повторить
          </button>
        )}
      </main>

      <form onSubmit={submit}>
        <label htmlFor="composer">Сообщение</label>
        <textarea
          id="composer"
          ref={inputRef}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter — отправить, Shift+Enter — перенос строки"
        />

        <label htmlFor="model">Модель</label>
        <select
          id="model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={models.length === 0}
        >
          {models.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>

        {isStreaming ? (
          <button type="button" onClick={stop}>
            Стоп
          </button>
        ) : (
          <button type="submit" disabled={draft.trim() === ''}>
            Отправить
          </button>
        )}
      </form>
    </>
  )
}

function MessageView({ message }: { message: Message }) {
  const author = message.role === 'user' ? 'Вы' : 'Модель'

  return (
    <article aria-busy={message.status === 'streaming'}>
      <h3>{author}</h3>
      {/* Plain text for now: markdown rendering comes with the styled UI. */}
      <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>

      {message.status === 'stopped' && <p>Генерация остановлена.</p>}

      {message.error !== undefined && (
        <p>
          {message.error.message}
          {message.error.retryAfter !== undefined && ` Повторите через ${message.error.retryAfter} с.`}
        </p>
      )}
    </article>
  )
}

function statusText(isStreaming: boolean, last: Message | undefined): string {
  if (isStreaming) return 'Модель печатает…'
  if (last === undefined || last.role !== 'assistant') return ''

  switch (last.status) {
    case 'done':
      return 'Ответ получен.'
    case 'stopped':
      return 'Генерация остановлена.'
    case 'error':
      return 'Ошибка при генерации.'
    default:
      return ''
  }
}
