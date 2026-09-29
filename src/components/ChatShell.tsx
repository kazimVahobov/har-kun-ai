import type { ReactNode, Ref } from 'react'
import type { DayContext } from '../lib/daytime.js'
import styles from './ChatShell.module.css'
import { DayRule } from './DayRule.js'

/**
 * The layout, kept apart from what fills it. The semantics are the spec's:
 * a skip link first, then `<header>`, then `<main>` holding the conversation
 * and the composer.
 */
export function ChatShell({
  day,
  log,
  footer,
  contents,
  logRef,
}: {
  day: DayContext
  log: ReactNode
  footer: ReactNode
  /** The conversation's contents, in the right margin (ADR 0015). */
  contents?: ReactNode
  logRef?: Ref<HTMLDivElement>
}) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#composer">
        К полю ввода
      </a>

      <header className="nav">
        {/* The mark and the date. A daily assistant should know what day it is
            and say so without being asked — and the navbar is where it stays
            true once a conversation has started and the empty state is gone.
            No bottom border: this system separates areas with air. */}
        <span className="nav-brand">Har Kun</span>
        <span className={styles.navDate}>{day.date}</span>
      </header>

      <main className={styles.main}>
        {/* The day lives in exactly one place at a time. Here, in the left
            margin, when there is margin to spare; in the empty state's column
            when there is not. Atmosphere rather than information — the greeting
            and the date carry the same thing in text, so this is hidden from
            assistive technology. */}
        <aside className={styles.dayPanel} aria-hidden="true">
          <DayRule progress={day.progress} time={day.time} orientation="vertical" />
        </aside>

        {/* A scrollable region needs to be reachable from the keyboard, or its
            content can only be read with a mouse. Browsers are inconsistent
            about doing this on their own, so it is stated. Not role="log":
            that carries an implicit live region, which would announce every
            token — the status line is the one place that speaks. */}
        {contents !== undefined && <div className={styles.contentsPanel}>{contents}</div>}

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
          <div className={styles.container}>{footer}</div>
        </div>
      </main>
    </div>
  )
}
