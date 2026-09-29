import { describe, expect, it } from 'vitest'
import { dayContext, dayPartAt, dayProgressAt, formatDate } from './daytime.js'

/** Local time, because the day a person is in is their own, not UTC's. */
const at = (hour: number, minute = 0) => new Date(2026, 8, 29, hour, minute)

describe('part of the day', () => {
  it.each([
    [0, 'night'],
    [4, 'night'],
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [22, 'evening'],
    [23, 'night'],
  ] as const)('%i:00 is %s', (hour, expected) => {
    expect(dayPartAt(at(hour))).toBe(expected)
  })
})

describe('progress along the day', () => {
  it('is zero at midnight and just under one at the last minute', () => {
    expect(dayProgressAt(at(0, 0))).toBe(0)
    expect(dayProgressAt(at(23, 59))).toBeCloseTo(1, 2)
  })

  it('is one half at noon', () => {
    expect(dayProgressAt(at(12, 0))).toBe(0.5)
  })

  it('never reaches one, so the mark stays on the line', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const value = dayProgressAt(at(hour, 59))
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('the date line', () => {
  it('reads as a Russian weekday and date', () => {
    expect(formatDate(at(9))).toBe('вторник, 29 сентября')
  })
})

describe('context', () => {
  it('greets according to the hour', () => {
    expect(dayContext(at(8)).greeting).toBe('Доброе утро')
    expect(dayContext(at(20)).greeting).toBe('Добрый вечер')
  })

  it('offers starters that suit the hour', () => {
    // The point of the whole module: morning and night do not offer the same
    // things, which is what makes "every day" behaviour rather than a slogan.
    const morning = dayContext(at(8)).prompts
    const night = dayContext(at(2)).prompts

    expect(morning).not.toEqual(night)
    expect(morning).toHaveLength(3)
    expect(night).toHaveLength(3)
  })

  it('offers three starters at any hour', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(dayContext(at(hour)).prompts).toHaveLength(3)
    }
  })
})
