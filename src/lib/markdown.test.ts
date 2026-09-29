import { describe, expect, it } from 'vitest'
import { closeOpenFences } from './markdown.js'

describe('closing open code fences', () => {
  it('leaves a balanced document alone', () => {
    const text = 'before\n```ts\ncode\n```\nafter'
    expect(closeOpenFences(text)).toBe(text)
  })

  it('leaves a document with no fences alone', () => {
    expect(closeOpenFences('just text')).toBe('just text')
  })

  it('closes a fence that is still open', () => {
    // This is the whole point: until the closing ``` arrives, everything after
    // the opening one renders as code, and the answer visibly gets swallowed.
    expect(closeOpenFences('text\n```ts\nconst a = 1')).toBe('text\n```ts\nconst a = 1\n```')
  })

  it('does not add a blank line when the text already ends with one', () => {
    expect(closeOpenFences('```ts\ncode\n')).toBe('```ts\ncode\n```')
  })

  it('closes only the last of several fences when the count is odd', () => {
    const text = '```\na\n```\ntext\n```js\nb'
    expect(closeOpenFences(text)).toBe(`${text}\n\`\`\``)
  })

  it('counts a fence indented up to three spaces', () => {
    // Markdown allows that much indentation before a fence still counts.
    expect(closeOpenFences('   ```\ncode')).toBe('   ```\ncode\n```')
  })

  it('ignores backticks that are not at the start of a line', () => {
    const text = 'inline ```not a fence``` here'
    expect(closeOpenFences(text)).toBe(text)
  })
})
