/**
 * A question reduced to a label.
 *
 * Two things happen here that CSS cannot do. Whitespace is collapsed, because a
 * pasted question can arrive as several paragraphs and a one-line label built
 * from it would otherwise carry the line breaks as gaps. And the cut lands on a
 * word boundary, so the label reads as a phrase rather than stopping mid-word.
 *
 * CSS still truncates whatever is left over: this cap is generous on purpose,
 * since the rail's width — not a character count — decides what actually fits.
 */

const DEFAULT_MAX = 64

export function summarise(text: string, maxChars: number = DEFAULT_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= maxChars) return flat

  const cut = flat.lastIndexOf(' ', maxChars)

  // A single word longer than the budget has no boundary to cut on; a hard cut
  // is better than returning the whole thing.
  const head = cut > maxChars / 2 ? flat.slice(0, cut) : flat.slice(0, maxChars)

  return `${head.replace(/[\s,;:.—–-]+$/u, '')}…`
}
