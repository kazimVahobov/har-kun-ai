import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Sticks the log to the bottom while an answer grows — and stops the moment the
 * user scrolls up themselves. Without that opt-out you cannot reread the start
 * of an answer while it is still being generated: every token drags you back
 * down.
 */

/** Close enough to the bottom to count as following along. */
const PIN_THRESHOLD_PX = 64

export interface AutoScroll {
  ref: React.RefObject<HTMLDivElement | null>
  /** False once the user has scrolled away; the caller offers a way back. */
  isPinned: boolean
  scrollToBottom(): void
}

export function useAutoScroll(dependency: unknown): AutoScroll {
  const ref = useRef<HTMLDivElement>(null)
  const [isPinned, setPinned] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (node === null) return

    // Programmatic scrolling fires this too, and that is fine: scrolling to the
    // bottom leaves us at the bottom, so the flag simply stays true. No need to
    // track who caused the scroll.
    const onScroll = (): void => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight
      setPinned(distance <= PIN_THRESHOLD_PX)
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    const node = ref.current
    if (node === null || !isPinned) return

    // Instant, not smooth: a smooth scroll cannot keep up with tokens arriving
    // every few dozen milliseconds, and ends up permanently behind.
    node.scrollTop = node.scrollHeight
  }, [dependency, isPinned])

  const scrollToBottom = useCallback(() => {
    const node = ref.current
    if (node === null) return

    // Smooth here: this one is a deliberate jump, and the browser already
    // honours prefers-reduced-motion for it.
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [])

  return { ref, isPinned, scrollToBottom }
}
