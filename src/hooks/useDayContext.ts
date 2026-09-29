import { useEffect, useMemo, useState } from 'react'
import { dayContext, type DayContext } from '../lib/daytime.js'

/**
 * Today, kept current. The clock is read here rather than inside `daytime.ts`
 * so that module stays a pure function of a `Date` and can be tested at its
 * boundaries.
 *
 * A minute is the right granularity: the mark on the day rule moves about one
 * pixel in that time, and anything finer would re-render for nothing.
 */
export function useDayContext(): DayContext {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return useMemo(() => dayContext(now), [now])
}
