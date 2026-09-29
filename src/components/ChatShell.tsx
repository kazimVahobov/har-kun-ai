import type { ReactNode, Ref } from 'react'
import styles from './ChatShell.module.css'

/**
 * The layout, kept apart from what fills it. The semantics are the spec's:
 * a skip link first, then `<header>`, then `<main>` holding the conversation
 * and the composer.
 */
export function ChatShell({
  log,
  footer,
  floating,
  logRef,
}: {
  log: ReactNode
  footer: ReactNode
  /** Sits above the composer without taking part in its layout. */
  floating?: ReactNode
  logRef?: Ref<HTMLDivElement>
}) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#composer">
        К полю ввода
      </a>

      <header className="nav">
        {/* The logo and nothing else: no settings, and the model picker lives
            in the composer. No bottom border — this system has no dividers. */}
        <span className="nav-brand">har kun ai</span>
      </header>

      <main className={styles.main}>
        {/* A scrollable region needs to be reachable from the keyboard, or its
            content can only be read with a mouse. Browsers are inconsistent
            about doing this on their own, so it is stated. Not role="log":
            that carries an implicit live region, which would announce every
            token — the status line is the one place that speaks. */}
        <div
          className={styles.log}
          ref={logRef}
          tabIndex={0}
          role="region"
          aria-label="История диалога"
        >
          <div className={`${styles.container} ${styles.logInner}`}>{log}</div>
        </div>

        <div className={styles.footer}>
          {floating !== undefined && <div className={styles.floating}>{floating}</div>}
          <div className={styles.container}>{footer}</div>
        </div>
      </main>
    </div>
  )
}
