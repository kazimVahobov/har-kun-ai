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
        <div className={styles.log} ref={logRef}>
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
