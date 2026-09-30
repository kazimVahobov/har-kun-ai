import type { CSSProperties } from 'react'
import type { DayContext } from '../lib/daytime.js'
import { DayRule } from './DayRule.js'
import styles from './EmptyState.module.css'

/** Staggering as data, so the order is legible where the markup is. */
const delay = (ms: number): CSSProperties => ({ '--delay': `${ms}ms` }) as CSSProperties

export function EmptyState({ day, onPick }: { day: DayContext; onPick(text: string): void }) {
  return (
    <section className={styles.root} aria-labelledby="empty-title">
      <h2 id="empty-title" className={`${styles.greeting} ${styles.reveal}`} style={delay(0)}>
        {day.greeting}
      </h2>

      <div className={`${styles.rule} ${styles.reveal}`} style={delay(70)}>
        <DayRule progress={day.progress} time={day.time} />
      </div>

      {/* One line, doing two jobs: it explains a name that means nothing to
          anyone who does not speak Uzbek, and turns that meaning into the
          promise. What the app does with a stream is shown, not announced. */}
      <p className={`${styles.slogan} ${styles.reveal}`} style={delay(140)}>
        <span className={styles.name}>«Har Kun»</span> — «каждый день» по-узбекски. Помощник на
        каждый из них.
      </p>

      <ul
        className={`${styles.prompts} ${styles.reveal}`}
        style={delay(210)}
        aria-label="С чего начать"
      >
        {day.prompts.map((prompt) => (
          <li key={prompt.text}>
            {/* A card rather than a pill: room for what kind of work it is and
                what comes back, so the choice is legible before the click.
                Fills the field and moves focus there, but never sends — the
                user has to be able to change their mind or add to it. */}
            <button type="button" className={styles.card} onClick={() => onPick(prompt.text)}>
              <span className={`card-kicker ${styles.kicker}`}>{prompt.kicker}</span>
              <span className={styles.cardTitle}>{prompt.text}</span>
              <span className={styles.cardHint}>{prompt.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
