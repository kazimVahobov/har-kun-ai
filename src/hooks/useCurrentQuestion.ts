import { useEffect, useState, type RefObject } from 'react'

/**
 * Which question the reader is currently inside.
 *
 * Computed from the log's scroll position rather than watched with an
 * `IntersectionObserver`. The observer reports *changes* in intersection, and a
 * long answer can fill the whole screen with no question anywhere near the top
 * — at which point it says nothing and the rail keeps pointing at whatever was
 * there when it was created. Asking outright which question is the last one
 * above the fold has no such gap.
 */

/** How far down the log counts as "here". */
const BAND_PX = 96

export function useCurrentQuestion(
  logRef: RefObject<HTMLElement | null>,
  questionIds: string[],
): string | undefined {
  const [currentId, setCurrentId] = useState<string | undefined>(undefined)

  // A stable dependency: the array is rebuilt on every render, the ids are not.
  const key = questionIds.join('|')

  useEffect(() => {
    const root = logRef.current
    if (root === null || key === '') {
      setCurrentId(undefined)
      return
    }

    const ids = key.split('|')

    const measure = (): void => {
      const top = root.getBoundingClientRect().top + BAND_PX
      let active = ids[0]

      for (const id of ids) {
        const element = document.getElementById(`message-${id}`)
        if (element === null) continue
        // The last question whose start has gone past the band is the one whose
        // section you are reading.
        if (element.getBoundingClientRect().top <= top) active = id
        else break
      }

      // The last question can never cross the band if the answer under it is
      // shorter than a screen — you would be looking at it while the rail
      // pointed at the one before. Reaching the end means being at the end.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 8) {
        active = ids[ids.length - 1]
      }

      setCurrentId(active)
    }

    // Measured straight from the scroll event rather than throttled through
    // `requestAnimationFrame`. rAF does not run while the page is hidden, and
    // throttling with it made the rail stop tracking in a background tab — a
    // real dependency on visibility bought in exchange for skipping a handful
    // of rect reads. The listener is passive and the work is bounded by the
    // number of questions.
    measure()
    root.addEventListener('scroll', measure, { passive: true })

    return () => root.removeEventListener('scroll', measure)
  }, [logRef, key])

  return currentId
}
