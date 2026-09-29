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

          {isStreaming ? (
            <button
              type="button"
              className={`btn btn-secondary btn-icon ${styles.send}`}
              onClick={onStop}
              aria-label="Остановить генерацию"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              className={`btn btn-primary btn-icon ${styles.send}`}
              disabled={value.trim() === ''}
              aria-label="Отправить сообщение"
            >
              <ArrowUpIcon />
            </button>
          )}
        </div>
      </div>

      {/* Under the frame rather than inside it: a key map and a caveat are about
          the control, not part of it, and the row inside was the first place to
          run out of room. */}
      <div className={styles.footnote}>
        <ul className={styles.keys}>
          <li>Esc — остановить</li>
          <li>Enter — отправить</li>
          {/* A touch keyboard has no Shift to hold, so on the screens where the
              line runs short this one names a key that is not there. */}
          <li className={styles.keyExtra}>Shift + Enter — перенос строки</li>
        </ul>

        <p className={styles.caveat}>ИИ может ошибаться — перепроверяйте важные ответы.</p>
      </div>
    </form>
  )
}
