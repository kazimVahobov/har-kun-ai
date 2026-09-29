import styles from './DayRule.module.css'

/** Every six hours. Midnight is labelled once, at the start. */
const LABELLED_HOURS = [0, 6, 12, 18] as const

/**
 * Midnight to midnight, with hour ticks, a reading every six hours, and the
 * clock beside the mark.
 *
 * Decorative: the greeting and the date carry the same thing in text, so a
 * screen reader is spared a scale whose entire content is a position.
 */
export function DayRule({
  progress,
  time,
  orientation = 'horizontal',
}: {
  progress: number
  time: string
  orientation?: 'horizontal' | 'vertical'
}) {
  const vertical = orientation === 'vertical'
  const along = (fraction: number) => `${(fraction * 100).toFixed(3)}%`
  const place = (fraction: number) =>
    vertical ? { top: along(fraction) } : { left: along(fraction) }

  return (
    <div
      className={`${styles.root} ${vertical ? styles.vertical : styles.horizontal}`}
      aria-hidden="true"
    >
      <div className={styles.line} />
      <div className={styles.ticks} />

      {LABELLED_HOURS.map((hour) => (
        <span key={hour} className={styles.label} style={place(hour / 24)}>
          {String(hour).padStart(2, '0')}
        </span>
      ))}

      <div className={styles.mark} style={place(progress)} />
      <span className={styles.now} style={place(progress)}>
        {time}
      </span>
    </div>
  )
}
