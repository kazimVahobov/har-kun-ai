import {
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import type { ModelInfo } from '../../shared/contract.js'
import { ArrowUpIcon, StopIcon } from './icons/index.js'
import styles from './Composer.module.css'

export interface ComposerProps {
  value: string
  onChange(value: string): void
  onSubmit(): void
  onStop(): void
  isStreaming: boolean
  models: ModelInfo[]
  model: string
  onModelChange(model: string): void
  /** Lets the empty state's examples put focus here after filling the field. */
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  models,
  model,
  onModelChange,
  inputRef,
}: ComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? localRef

  // Grow with the content up to the max-height the stylesheet sets, then let
  // the field scroll. Done on layout so the height never renders one frame late.
  useLayoutEffect(() => {
    const input = ref.current
    if (input === null) return

    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [value])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    onSubmit()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends, Shift+Enter breaks a line. The composer is a textarea
    // precisely so the second one is possible.
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={submit}>
      {/* Both labels sit outside the frame. They are associated by `htmlFor`, so
          position is irrelevant to a screen reader — but inside a flex container
          they are flex items, and the container's gap applies to them, nudging
          the field and the picker out of line with each other. */}
      <label className="visually-hidden" htmlFor="composer">
        Сообщение модели
      </label>
      <label className="visually-hidden" htmlFor="model">
        Модель
      </label>

      <div className={styles.frame}>
        <textarea
          id="composer"
          ref={ref}
          className={styles.input}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Спросите что-нибудь"
        />

        <div className={styles.row}>
          <select
            id="model"
            className={styles.model}
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={models.length === 0}
          >
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>

          <div className={styles.actions}>
            <span className={styles.hint}>
              {isStreaming ? (
                // While an answer is arriving, Enter does nothing and a line
                // break is beside the point. Stopping is the only key that acts.
                'Esc — остановить'
              ) : (
                <>
                  Enter — отправить
                  <span className={styles.hintExtra}>Shift + Enter — перенос строки</span>
                </>
              )}
            </span>

            {isStreaming ? (
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={onStop}
                aria-label="Остановить генерацию"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary btn-icon"
                disabled={value.trim() === ''}
                aria-label="Отправить сообщение"
              >
                <ArrowUpIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
