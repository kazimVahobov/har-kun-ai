import type { Request, Response } from 'express'
import {
  isSimulateMode,
  type ApiError,
  type ChatMessage,
  type ChatRequest,
  type SimulateMode,
} from '../shared/contract.js'
import { config } from './env.js'
import { mockProducer } from './mock.js'
import { defaultModel, isAllowedModel } from './models.js'
import { openRouterProducer } from './openrouter.js'
import { runStream, sendError } from './stream.js'

export async function handleChat(req: Request, res: Response): Promise<void> {
  const parsed = parseRequest(req.body)
  if ('error' in parsed) {
    sendError(res, parsed.error)
    return
  }

  const simulate = readSimulate(req)

  // A 429 arrives before the stream starts, so it goes out as a status, not an event.
  if (simulate === '429') {
    sendError(res, {
      code: 'rate_limited',
      message: 'Бесплатная модель сейчас занята. Попробуйте позже или смените модель.',
      retryAfter: 12,
    })
    return
  }

  const model = parsed.value.model ?? defaultModel()

  if (config.useMock) {
    await runStream(res, model, mockProducer(model, simulate), { ragged: true })
    return
  }

  await runStream(res, model, openRouterProducer(parsed.value, model))
}

// ── Request parsing ──────────────────────────────────────────────────────────

type Parsed = { value: ChatRequest } | { error: ApiError }

function parseRequest(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null) {
    return { error: { code: 'bad_request', message: 'Тело запроса должно быть объектом' } }
  }

  const { messages, model } = body as { messages?: unknown; model?: unknown }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: { code: 'bad_request', message: 'Нужен непустой список сообщений' } }
  }

  if (!messages.every(isChatMessage)) {
    return { error: { code: 'bad_request', message: 'Сообщение должно иметь role и content' } }
  }

  if (model !== undefined) {
    if (typeof model !== 'string' || !isAllowedModel(model)) {
      return { error: { code: 'bad_request', message: `Неизвестная модель: ${String(model)}` } }
    }
  }

  return { value: { messages, model: model as string | undefined } }
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const { role, content } = value as { role?: unknown; content?: unknown }
  return (role === 'user' || role === 'assistant') && typeof content === 'string'
}

/**
 * The failure modes belong to the mock — they are how it reproduces what a live
 * model does only by luck. Off in production, and off against a real model,
 * where a manufactured failure would mean nothing.
 */
function readSimulate(req: Request): SimulateMode | undefined {
  if (!config.allowSimulate || !config.useMock) return undefined
  const raw = req.query['simulate']
  return isSimulateMode(raw) ? raw : undefined
}
