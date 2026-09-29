import { useEffect, useRef, useState } from 'react'
import { ChatShell } from './components/ChatShell.js'
import { Composer } from './components/Composer.js'
import { EmptyState } from './components/EmptyState.js'
import { MessageList } from './components/Message.js'
import { useChat } from './hooks/useChat.js'
import type { Message } from './lib/types.js'

export function App() {
  const { chat, models, model, isStreaming, send, stop, retry, setModel } = useChat()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
          // An example fills the field and moves focus there, but never sends:
          // the user has to be able to change their mind or add to it.
          <EmptyState
            onPick={(text) => {
              setDraft(text)
              inputRef.current?.focus()
            }}
          />
        ) : (
          <MessageList messages={chat.messages} />
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
            inputRef={inputRef}
          />
        </>
      }
    />
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
