/**
 * The registry of running generations, keyed by `chatId`.
 *
 * It lives outside the React tree on purpose. Keep an `AbortController` in
 * component state and unmounting on a chat switch kills the stream — which is
 * exactly what must not happen (ADR 0011). In exchange, clearing an entry when
 * a stream ends is a manual responsibility, so every exit path goes through
 * `finish`.
 */

export interface StreamRegistry {
  /** A controller for a new stream. Any stream already running for the chat is aborted. */
  register(chatId: string): AbortController
  isActive(chatId: string): boolean
  activeChatIds(): string[]
  /** Aborts the chat's stream. Returns whether there was one. */
  abort(chatId: string): boolean
  abortAll(): void
  /** Drops the entry once a stream has ended on its own. */
  finish(chatId: string): void
}

export function createStreamRegistry(): StreamRegistry {
  const controllers = new Map<string, AbortController>()

  return {
    register(chatId) {
      // One generation per chat: a second send in the same chat replaces the
      // first rather than racing it into the same message.
      controllers.get(chatId)?.abort()

      const controller = new AbortController()
      controllers.set(chatId, controller)
      return controller
    },

    isActive(chatId) {
      return controllers.has(chatId)
    },

    activeChatIds() {
      return [...controllers.keys()]
    },

    abort(chatId) {
      const controller = controllers.get(chatId)
      if (controller === undefined) return false

      controllers.delete(chatId)
      controller.abort()
      return true
    },

    abortAll() {
      for (const controller of controllers.values()) controller.abort()
      controllers.clear()
    },

    finish(chatId) {
      controllers.delete(chatId)
    },
  }
}
