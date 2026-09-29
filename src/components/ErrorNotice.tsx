import { useEffect, useState } from 'react'
import type { ApiError, ErrorCode } from '../../shared/contract.js'
import { RetryIcon, WarningIcon } from './icons/index.js'
import styles from './ErrorNotice.module.css'

/**
 * A short title per code. The contract's own `message` is the detail line
 * beneath it: it explains what happened, while the title says what kind of
 * thing it was at a glance.
 */
const TITLES: Record<ErrorCode, string> = {
  rate_limited: 'Модель занята',
  timeout: 'Модель не ответила',
  upstream_unavailable: 'Нет связи с моделью',
  upstream_error: 'Генерация прервалась',
  bad_request: 'Запрос не принят',
  internal: 'Что-то пошло не так',
}

export function ErrorNotice({
  error,
  failedAt,
  onRetry,
}: {
  error: ApiError
  /** When the failure happened, so the wait is a moment rather than a duration. */
  failedAt?: number
  onRetry?: () => void
}) {
  const until =
    error.retryAfter !== undefined && failedAt !== undefined
      ? failedAt + error.retryAfter * 1000
      : undefined
  const remaining = useCountdown(until)
  const waiting = remaining > 0

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <WarningIcon className={styles.icon} />
        <h4 className={styles.title}>{TITLES[error.code] ?? TITLES.internal}</h4>
        <span className={`tag tag-outline ${styles.code}`}>{error.code}</span>
      </div>

      <p className={styles.detail}>{error.message}</p>

      {onRetry !== undefined && (
        <div className={styles.actions}>
          {/* The wait reads first and the button sits on the edge: the sentence
              explains why the control beside it is dim. */}
          {waiting && <span className={styles.wait}>Можно через {remaining} с</span>}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRetry}
            // The upstream said how long to wait. Letting the button through
            // before then just spends another request on the same refusal.
            disabled={waiting}
          >
            Повторить
            <RetryIcon />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Seconds left until a moment, recomputed from the clock on every tick rather
 * than decremented.
 *
 * Counting down from a duration meant the wait restarted at its full length
 * after a reload, however much of it had already passed — and a throttled
 * background tab made it drift. Reading the clock each time has neither
 * problem: it simply reports what is left.
 */
function useCountdown(until: number | undefined): number {
  const [remaining, setRemaining] = useState(() => secondsUntil(until))

  useEffect(() => {
    setRemaining(secondsUntil(until))
    if (until === undefined || secondsUntil(until) <= 0) return

    const timer = setInterval(() => {
      const left = secondsUntil(until)
      setRemaining(left)
      if (left <= 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [until])

  return remaining
}

function secondsUntil(until: number | undefined): number {
  if (until === undefined) return 0
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}
