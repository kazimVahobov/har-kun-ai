import styles from './StatusLine.module.css'

export function StatusLine({ isStreaming, text }: { isStreaming: boolean; text: string }) {
  return (
    <p className={styles.root} role="status" aria-live="polite">
      {isStreaming && (
        // Decoration only: the wording next to it is what gets announced.
        <span className={styles.dots} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </span>
      )}
      {text}
    </p>
  )
}
