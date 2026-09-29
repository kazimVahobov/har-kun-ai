import { useEffect, useState } from 'react'
import type { Message } from '../lib/types.js'
import { ErrorNotice } from './ErrorNotice.js'
import { Markdown } from './Markdown.js'
import { CheckIcon, CopyIcon, RetryIcon } from './icons/index.js'
import styles from './Message.module.css'

export function MessageList({
  messages,
  onRetry,
}: {
  messages: Message[]
  onRetry?: () => void
}) {
  const lastIndex = messages.length - 1

  return (
    <ol className={styles.list}>
      {messages.map((message, index) => (
        <li
          key={message.id}
          id={`message-${message.id}`}
          // Only questions are watched and only questions are listed, so only
          // they need the marker.
          data-message-id={message.role === 'user' ? message.id : undefined}
          className={`${styles.item} ${message.role === 'user' ? styles.itemUser : ''}`}
        >
          <MessageView
            message={message}
            // Retrying anything but the last answer would rewrite history the
            // conversation has already built on.
            onRetry={index === lastIndex ? onRetry : undefined}
          />
        </li>
      ))}
    </ol>
  )
}

function MessageView({ message, onRetry }: { message: Message; onRetry?: () => void }) {
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'

  return (
    <article className={isUser ? styles.user : styles.model} aria-busy={isStreaming}>
      {/* The author is carried visually by fill and position, which a screen
          reader cannot see — so it is named here instead. */}
      <h3 className="visually-hidden">{isUser ? 'Вы' : 'Модель'}</h3>

      {/* Only the model's answer is markdown. What the user typed comes back
          exactly as written rather than being reinterpreted as syntax. */}
      {isUser ? (
        <div className={styles.content}>{message.content}</div>
      ) : (
        <Markdown text={message.content} />
      )}

      {/* The received text stays above, untouched: a partial answer is a valid
          result, not something to replace with an error. */}
      {message.error !== undefined && <ErrorNotice error={message.error} onRetry={onRetry} />}

      {!isUser && !isStreaming && (
        <div className={styles.actions}>
          {message.content !== '' && <CopyButton text={message.content} />}

          {message.status === 'stopped' && onRetry !== undefined && (
            <button type="button" className="btn btn-ghost" onClick={onRetry}>
              <RetryIcon />
              Повторить
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = (): void => {
    // Fails without a secure context or permission. Nothing to tell the user
    // that they could act on, so the state simply does not change.
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => undefined)
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={copy}
      aria-label={copied ? 'Скопировано' : 'Копировать ответ'}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Скопировано' : 'Копировать'}
    </button>
  )
}
