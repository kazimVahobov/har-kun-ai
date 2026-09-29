/**
 * Preparing a partially-arrived answer for markdown rendering.
 *
 * A stream is parsed while it is still mid-syntax, and one construct is
 * destructive when left open: a code fence. Until its closing ``` arrives, the
 * whole rest of the answer is inside the code block — so as tokens come in, the
 * reader watches their answer get swallowed and spat back out.
 *
 * Other unterminated syntax is harmless by comparison: an unclosed `**` or a
 * single backtick just renders as literal characters until it closes.
 */

const FENCE = /^ {0,3}```/gm

export function closeOpenFences(markdown: string): string {
  const fences = markdown.match(FENCE)
  if (fences === null || fences.length % 2 === 0) return markdown

  const separator = markdown.endsWith('\n') ? '' : '\n'
  return `${markdown}${separator}\`\`\``
}
