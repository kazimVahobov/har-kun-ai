import { useEffect, useState } from 'react'
import { ChatShell } from './components/ChatShell.js'
import { Composer } from './components/Composer.js'
import { useChat } from './hooks/useChat.js'
import type { Message } from './lib/types.js'

export function App() {
  const { chat, models, model, isStreaming, send, stop, retry, setModel } = useChat()
  const [draft, setDraft] = useState('')

  // Esc stops generation from anywhere on the page. It lives here rather than
  // in the hook because once the sidebar exists, Esc has to close that first.
  useEffect(() => {
    if (!isStreaming) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') stop()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStreaming, stop])

  const submit = (): void => {
    if (isStreaming || draft.trim() === '') return
    send(draft)
    setDraft('')
  }

  const lastMessage = chat.messages[chat.messages.length - 1]
  const canRetry =
    lastMessage?.role === 'assistant' &&
    (lastMessage.status === 'error' || lastMessage.status === 'stopped')

  return (
    <ChatShell
      log={
        chat.messages.length === 0 ? (
          <section aria-labelledby="empty-title">
            <h3 id="empty-title">Спросите что-нибудь</h3>
            <p className="text-muted">
              «har kun» по-узбекски — «каждый день». Модель отвечает потоком, ответ можно прервать.
            </p>
          </section>
        ) : (
          <ol>
            {chat.messages.map((message) => (
              <li key={message.id}>
                <PlainMessage message={message} />
              </li>
            ))}
          </ol>
        )
      }
      footer={
        <>
          <p role="status" aria-live="polite" className="text-muted">
            {statusText(isStreaming, lastMessage)}
          </p>

          {canRetry && (
            <button type="button" className="btn btn-ghost" onClick={retry}>
              Повторить
            </button>
          )}

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onStop={stop}
            isStreaming={isStreaming}
            models={models}
            model={model}
            onModelChange={setModel}
          />
        </>
      }
    />
  )
}

/** Placeholder rendering — messages get their own component in the next step. */
function PlainMessage({ message }: { message: Message }) {
  return (
    <article aria-busy={message.status === 'streaming'}>
      <h4>{message.role === 'user' ? 'Вы' : 'Модель'}</h4>
      <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
      {message.error !== undefined && <p>{message.error.message}</p>}
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
