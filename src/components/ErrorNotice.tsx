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

export function ErrorNotice({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const remaining = useCountdown(error.retryAfter)
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRetry}
            // The upstream said how long to wait. Letting the button through
            // before then just spends another request on the same refusal.
            disabled={waiting}
          >
            <RetryIcon />
            Повторить
          </button>

          {waiting && <span className={styles.wait}>Можно через {remaining} с</span>}
        </div>
      )}
    </div>
  )
}

function useCountdown(seconds: number | undefined): number {
  const [remaining, setRemaining] = useState(seconds ?? 0)

  // A fresh error resets the clock; without this the component would keep
  // counting down from whatever the previous one said.
  useEffect(() => setRemaining(seconds ?? 0), [seconds])

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  return remaining
}
