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
          // An answer is a section of the page, not the page: its headings have
          // to sit below the one naming the message. Shifted by two so a `#` in
          // an answer cannot become a second h1 next to the mark's. The sizes
          // are unchanged — the stylesheet follows this mapping, not the
          // original levels.
          h1: 'h3',
          h2: 'h4',
          h3: 'h5',
          h4: 'h6',
          h5: 'h6',
          h6: 'h6',

          // `node` is destructured away rather than spread: react-markdown
          // passes the hast node to every custom component, and forwarding it
          // to a DOM element makes React complain about an unknown attribute.
          a: ({ node: _node, children, ...props }) => (
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
