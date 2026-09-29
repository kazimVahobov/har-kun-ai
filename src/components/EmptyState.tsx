import styles from './EmptyState.module.css'

/**
 * Examples are deliberately about this app rather than generic prompts: they
 * double as an explanation of what the thing in front of you does.
 */
const EXAMPLES = [
  'Объясни, как работает потоковая передача ответа',
  'Чем Server-Sent Events отличаются от WebSocket',
  'Напиши пример отмены fetch через AbortController',
]

export function EmptyState({ onPick }: { onPick(text: string): void }) {
  return (
    <section className={styles.root} aria-labelledby="empty-title">
      {/* Not a repeat of the logo sitting right above it: the heading says what
          this is, the lede explains the name. */}
      <h3 id="empty-title" className={styles.title}>
        Чат с языковой моделью
      </h3>

      <p className={styles.lede}>
        «har kun» по-узбекски — «каждый день». Ответ появляется по мере генерации, и его можно
        оборвать на середине, не потеряв уже полученное.
      </p>

      <p className={styles.examplesLabel} id="examples-label">
        Примеры
      </p>

      <ul className={styles.examples} aria-labelledby="examples-label">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              className={`btn btn-secondary ${styles.example}`}
              onClick={() => onPick(example)}
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
