import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { closeOpenFences } from '../lib/markdown.js'
import styles from './Markdown.module.css'

/**
 * Model answers render as markdown; what the user typed does not. Their own
 * text should come back exactly as written rather than being reinterpreted as
 * syntax.
 *
 * No `rehype-raw`, deliberately: model output is untrusted input, and raw HTML
 * from it must never reach the DOM. Without that plugin react-markdown escapes
 * HTML rather than rendering it.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.root}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            // A link the model produced leads somewhere we know nothing about:
            // open it away from the app, and deny it a handle on this window.
            <a {...props} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {closeOpenFences(text)}
      </ReactMarkdown>
    </div>
  )
}
