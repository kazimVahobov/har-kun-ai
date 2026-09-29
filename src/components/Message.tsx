import { useEffect, useState } from 'react'
import type { Message } from '../lib/types.js'
import { CheckIcon, CopyIcon } from './icons/index.js'
import styles from './Message.module.css'

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <ol className={styles.list}>
      {messages.map((message) => (
        <li
          key={message.id}
          className={`${styles.item} ${message.role === 'user' ? styles.itemUser : ''}`}
        >
          <MessageView message={message} />
        </li>
      ))}
    </ol>
  )
}

function MessageView({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <article
      className={isUser ? styles.user : styles.model}
      aria-busy={message.status === 'streaming'}
    >
      {/* The author is carried visually by fill and position, which a screen
          reader cannot see — so it is named here instead. */}
      <h3 className="visually-hidden">{isUser ? 'Вы' : 'Модель'}</h3>

      <div className={styles.content}>{message.content}</div>

      {!isUser && message.status !== 'streaming' && message.content !== '' && (
        <div className={styles.actions}>
          <CopyButton text={message.content} />
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
