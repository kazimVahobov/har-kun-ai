import styles from './DayRule.module.css'

/**
 * Midnight to midnight, with a mark where the clock actually stands.
 *
 * Decorative: the same information is in the greeting and the date beside it,
 * so a screen reader is spared a line it cannot read.
 */
export function DayRule({
  progress,
  orientation = 'horizontal',
}: {
  progress: number
  orientation?: 'horizontal' | 'vertical'
}) {
  const vertical = orientation === 'vertical'
  const offset = `${(progress * 100).toFixed(3)}%`

  return (
    <div
      className={`${styles.root} ${vertical ? styles.vertical : styles.horizontal}`}
      aria-hidden="true"
    >
      <div className={styles.line} />
      <div className={styles.mark} style={vertical ? { top: offset } : { left: offset }} />
      <span className={`${styles.tick} ${styles.tickStart}`}>00</span>
      <span className={`${styles.tick} ${styles.tickEnd}`}>24</span>
    </div>
  )
}
