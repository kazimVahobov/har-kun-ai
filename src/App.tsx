import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatShell } from './components/ChatShell.js'
import { Composer } from './components/Composer.js'
import { ContentsRail } from './components/ContentsRail.js'
import { EmptyState } from './components/EmptyState.js'
import { ArrowDownIcon } from './components/icons/index.js'
import { MessageList } from './components/Message.js'
import { StatusLine } from './components/StatusLine.js'
import { useAutoScroll } from './hooks/useAutoScroll.js'
import { useCurrentQuestion } from './hooks/useCurrentQuestion.js'
import { useDayContext } from './hooks/useDayContext.js'
import { useChat } from './hooks/useChat.js'
import type { Message } from './lib/types.js'

export function App() {
  const { chat, models, model, isStreaming, send, stop, retry, setModel } = useChat()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const day = useDayContext()

  // The message array is a new object on every delta, so this follows the
  // answer as it grows.
  const { ref: logRef, isPinned, scrollToBottom } = useAutoScroll(chat.messages)

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

  const questions = useMemo(
    () => chat.messages.filter((message) => message.role === 'user'),
    [chat.messages],
  )
  const currentQuestionId = useCurrentQuestion(
    logRef,
    useMemo(() => questions.map((question) => question.id), [questions]),
  )

  const goToQuestion = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`)
    if (element === null) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [])

  const lastMessage = chat.messages[chat.messages.length - 1]
  const canRetry =
    lastMessage?.role === 'assistant' &&
    (lastMessage.status === 'error' || lastMessage.status === 'stopped')
  const hasMessages = chat.messages.length > 0

  return (
    <ChatShell
      day={day}
      logRef={logRef}
      log={
        hasMessages ? (
          // Retry lives on the message that failed, not in the footer: the
          // error belongs to its cause.
          <MessageList messages={chat.messages} onRetry={canRetry ? retry : undefined} />
        ) : (
          // An example fills the field and moves focus there, but never sends:
          // the user has to be able to change their mind or add to it.
          <EmptyState
            day={day}
            onPick={(text) => {
              setDraft(text)
              inputRef.current?.focus()
            }}
          />
        )
      }
      contents={
        questions.length > 0 ? (
          <ContentsRail
            questions={questions}
            currentId={currentQuestionId}
            onPick={goToQuestion}
          />
        ) : undefined
      }
      footer={
        <>
          <StatusLine
            isStreaming={isStreaming}
            text={statusText(isStreaming, lastMessage)}
            action={
              hasMessages && !isPinned ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  onClick={scrollToBottom}
                  aria-label="К последнему сообщению"
                >
                  <ArrowDownIcon />
                </button>
              ) : undefined
            }
          />

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
  if (isStreaming) {
    // Between sending and the first token there is nothing on screen but a
    // promise, and on a free model that gap is routinely seconds long — the
    // request sits in a shared queue. Saying "печатает" through it is simply
    // untrue, and it is the stretch where a person most needs to know that
    // something is happening at all.
    return last?.role === 'assistant' && last.content === '' ? 'Ждём ответ' : 'Модель печатает'
  }

  if (last === undefined || last.role !== 'assistant') return ''

  switch (last.status) {
    case 'done':
      return 'Ответ получен'
    case 'stopped':
      // Nothing. Stopping is something the person just did on purpose, and
      // reporting it back is the interface repeating them. The answer itself
      // carries the state: its border closes, and one that was cut off before
      // its first character says so in the block.
      return ''
    case 'error':
      return 'Ошибка при генерации'
    default:
      return ''
  }
}
