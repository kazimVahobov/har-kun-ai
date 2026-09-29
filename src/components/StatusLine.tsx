import type { ReactNode } from 'react'
import styles from './StatusLine.module.css'

export function StatusLine({
  isStreaming,
  text,
  action,
}: {
  isStreaming: boolean
  text: string
  /** Sits opposite the chip. Outside the live region — a control is not news. */
  action?: ReactNode
}) {
  return (
    <div className={styles.root}>
      <div className={styles.live} role="status" aria-live="polite">
        {text !== '' && (
          <span className={styles.chip}>
            {isStreaming && (
              // Decoration only: the wording next to it is what gets announced.
              <span className={styles.dots} aria-hidden="true">
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </span>
            )}
            {text}
          </span>
        )}
      </div>

      {action}
    </div>
  )
}
