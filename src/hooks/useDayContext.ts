import { useEffect, useMemo, useState } from 'react'
import { dayContext, type DayContext } from '../lib/daytime.js'

const MINUTE_MS = 60_000

/**
 * Today, kept current. The clock is read here rather than inside `daytime.ts`
 * so that module stays a pure function of a `Date` and can be tested at its
 * boundaries.
 *
 * A minute is the right granularity — the mark on the day scale moves about a
 * pixel in that time — but the tick has to land *on* the minute. A plain
 * interval started at mount fires at whatever second the page happened to load,
 * so the clock beside the mark read up to fifty-nine seconds behind: measured
 * at six, which is simply when that tab was opened.
 */
export function useDayContext(): DayContext {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = (): void => setNow(new Date())
    let interval: ReturnType<typeof setInterval> | undefined

    // Wait out the remainder of the current minute, then keep step with it.
    const align = setTimeout(() => {
      tick()
      interval = setInterval(tick, MINUTE_MS)
    }, MINUTE_MS - (Date.now() % MINUTE_MS))

    // Timers are throttled in a background tab, so an hour away leaves the
    // clock behind. Coming back re-reads it rather than waiting for the tick.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(align)
      if (interval !== undefined) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return useMemo(() => dayContext(now), [now])
}
