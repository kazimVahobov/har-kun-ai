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

      <p className={`${styles.date} ${styles.reveal}`} style={delay(70)}>
        {day.date}
      </p>

      <div className={`${styles.rule} ${styles.reveal}`} style={delay(140)}>
        <DayRule progress={day.progress} time={day.time} />
      </div>

      <p className={`${styles.lede} ${styles.reveal}`} style={delay(210)}>
        Помощник на каждый день — «har kun» по-узбекски и значит «каждый день». Ответ появляется по
        мере генерации, и его можно оборвать на середине, не потеряв уже полученное.
      </p>

      <ul className={`${styles.prompts} ${styles.reveal}`} style={delay(280)} aria-label="С чего начать">
        {day.prompts.map((prompt) => (
          <li key={prompt}>
            {/* Fills the field and moves focus there, but never sends: the user
                has to be able to change their mind or add to it. */}
            <button
              type="button"
              className={`btn btn-secondary ${styles.prompt}`}
              onClick={() => onPick(prompt)}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
