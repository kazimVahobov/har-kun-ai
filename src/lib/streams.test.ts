import { describe, expect, it } from 'vitest'
import { createStreamRegistry } from './streams.js'

describe('stream registry', () => {
  it('tracks a registered stream', () => {
    const registry = createStreamRegistry()
    registry.register('c1')

    expect(registry.isActive('c1')).toBe(true)
    expect(registry.isActive('c2')).toBe(false)
    expect(registry.activeChatIds()).toEqual(['c1'])
  })

  it('aborts the stream it is asked to abort', () => {
    const registry = createStreamRegistry()
    const controller = registry.register('c1')

    expect(registry.abort('c1')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    expect(registry.isActive('c1')).toBe(false)
  })

  it('aborting a chat with no stream reports that there was none', () => {
    expect(createStreamRegistry().abort('c1')).toBe(false)
  })

  it('leaves other chats running when one is aborted', () => {
    // Esc and Stop act on the active chat only; a background generation
    // continues (ADR 0011).
    const registry = createStreamRegistry()
    const first = registry.register('c1')
    const second = registry.register('c2')

    registry.abort('c1')

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(registry.activeChatIds()).toEqual(['c2'])
  })

  it('replaces a running stream when the same chat starts another', () => {
    // One generation per chat: a second send must not race the first into the
    // same message.
    const registry = createStreamRegistry()
    const first = registry.register('c1')
    const second = registry.register('c1')

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(registry.activeChatIds()).toEqual(['c1'])
  })

  it('finish drops the entry without aborting', () => {
    // The stream ended on its own; aborting a finished controller would be
    // harmless but misleading.
    const registry = createStreamRegistry()
    const controller = registry.register('c1')

    registry.finish('c1')

    expect(registry.isActive('c1')).toBe(false)
    expect(controller.signal.aborted).toBe(false)
  })

  it('abortAll stops everything and empties the registry', () => {
    const registry = createStreamRegistry()
    const first = registry.register('c1')
    const second = registry.register('c2')

    registry.abortAll()

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(true)
    expect(registry.activeChatIds()).toEqual([])
  })
})
