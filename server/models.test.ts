import { describe, expect, it } from 'vitest'
import { readCatalogue } from './models.js'

/**
 * The catalogue is someone else's data and it moves: models appear, free tiers
 * are withdrawn, fields go missing. What is tested here is that none of that
 * can produce a broken picker.
 */

function catalogue(...entries: unknown[]): unknown {
  return { data: entries }
}

describe('readCatalogue', () => {
  it('keeps only the free models', () => {
    // A picker that can quietly spend money is not a picker.
    const models = readCatalogue(
      catalogue(
        { id: 'vendor/paid', name: 'Paid', context_length: 100 },
        { id: 'vendor/free:free', name: 'Free', context_length: 100 },
        { id: 'vendor/almost-free', name: 'Nearly', context_length: 100 },
      ),
    )

    expect(models.map((model) => model.id)).toEqual(['vendor/free:free'])
  })

  it('drops the "(free)" every name in this list would carry', () => {
    const [model] = readCatalogue(
      catalogue({ id: 'vendor/a:free', name: 'Vendor: Model A (free)', context_length: 8 }),
    )

    expect(model?.name).toBe('Vendor: Model A')
  })

  it('puts the preferred default first and sorts the rest by name', () => {
    const models = readCatalogue(
      catalogue(
        { id: 'zzz/other:free', name: 'Zzz', context_length: 8 },
        { id: 'aaa/other:free', name: 'Aaa', context_length: 8 },
        { id: 'google/gemma-4-31b-it:free', name: 'Google: Gemma 4 31B (free)', context_length: 8 },
      ),
    )

    expect(models.map((model) => model.id)).toEqual([
      'google/gemma-4-31b-it:free',
      'aaa/other:free',
      'zzz/other:free',
    ])
  })

  it('falls back to the id when a model has no name', () => {
    const [model] = readCatalogue(catalogue({ id: 'vendor/a:free', context_length: 8 }))
    expect(model?.name).toBe('vendor/a:free')
  })

  it('treats a missing context length as unknown rather than dropping the model', () => {
    const [model] = readCatalogue(catalogue({ id: 'vendor/a:free', name: 'A' }))
    expect(model).toMatchObject({ id: 'vendor/a:free', contextLength: 0 })
  })

  it('returns nothing rather than throwing on a payload it does not recognise', () => {
    expect(readCatalogue(undefined)).toEqual([])
    expect(readCatalogue(null)).toEqual([])
    expect(readCatalogue({})).toEqual([])
    expect(readCatalogue({ data: 'nope' })).toEqual([])
    expect(readCatalogue(catalogue(null, 42, { name: 'no id' }, { id: 7 }))).toEqual([])
  })
})
