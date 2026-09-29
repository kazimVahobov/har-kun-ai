import { useEffect, useRef } from 'react'
import { summarise } from '../lib/summarise.js'
import type { Message } from '../lib/types.js'
import styles from './ContentsRail.module.css'

export interface ContentsRailProps {
  questions: Message[]
  /** The question currently in view, if any. */
  currentId: string | undefined
  onPick(messageId: string): void
}

/**
 * One item per question asked. Clicking one goes back to it.
 *
 * Answers are not listed: they are long, and as labels they are
 * interchangeable. What someone is looking for is what they asked.
 */
export function ContentsRail({ questions, currentId, onPick }: ContentsRailProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const current = useRef<HTMLButtonElement>(null)

  // Follow the conversation: the item in view should not slide out of the rail
  // while the log moves under it.
  useEffect(() => {
    const item = current.current
    if (item === null || scroller.current === null) return

    item.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [currentId])

  return (
    <nav className={styles.root} aria-label="Вопросы в диалоге">
      <p className={styles.title}>Оглавление</p>

      <div className={styles.scroller} ref={scroller}>
        <ol className={styles.list}>
          {questions.map((question) => {
            const isCurrent = question.id === currentId

            return (
              <li key={question.id}>
                <button
                  type="button"
                  ref={isCurrent ? current : undefined}
                  className={`${styles.item} ${isCurrent ? styles.current : ''}`}
                  onClick={() => onPick(question.id)}
                  // The label is truncated to one line, so the full question
                  // lives where it can still be read or announced.
                  title={question.content}
                  aria-label={question.content}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  {summarise(question.content)}
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
