import { describe, expect, it } from 'vitest'
import { summarise } from './summarise.js'

describe('reducing a question to a label', () => {
  it('leaves a short question alone', () => {
    expect(summarise('Зачем нужен AbortController')).toBe('Зачем нужен AbortController')
  })

  it('collapses the whitespace of a pasted question', () => {
    // A question pasted from somewhere else arrives with its line breaks; a
    // one-line label built from it would carry them as gaps.
    expect(summarise('Первая строка\n\n   вторая\tстрока')).toBe('Первая строка вторая строка')
  })

  it('trims the edges', () => {
    expect(summarise('  вопрос  ')).toBe('вопрос')
  })

  it('cuts on a word boundary, not mid-word', () => {
    const text = 'Объясни, как работает потоковая передача ответа и зачем она нужна'
    const result = summarise(text, 30)

    expect(result.endsWith('…')).toBe(true)
    expect(text.startsWith(result.slice(0, -1))).toBe(true)
    // The cut landed between words, so the last one is whole. "потоковая"
    // would have crossed the budget, so it is left out entirely rather than
    // half-shown.
    expect(result).toBe('Объясни, как работает…')
  })

  it('does not leave punctuation hanging before the ellipsis', () => {
    expect(summarise('Сначала одно, потом другое и третье', 15)).toBe('Сначала одно…')
  })

  it('cuts hard when one word is longer than the whole budget', () => {
    const result = summarise('Супердлинноесловобезпробелов и хвост', 12)

    expect(result).toBe('Супердлинное…')
  })

  it('never returns more than the budget plus the ellipsis', () => {
    const long = 'слово '.repeat(200)
    expect(summarise(long, 40).length).toBeLessThanOrEqual(41)
  })
})
