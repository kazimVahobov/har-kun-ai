import type { Request, Response } from 'express'
import {
  isSimulateMode,
  type ApiError,
  type ChatMessage,
  type ChatRequest,
  type SimulateMode,
} from '../shared/contract.js'
import { config } from './env.js'
import { DEFAULT_MODEL, isKnownModel, mockProducer } from './mock.js'
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

  if (!config.useMock) {
    sendError(res, {
      code: 'upstream_unavailable',
      message: 'Живая модель ещё не подключена — она появится в фазе 3.',
    })
    return
  }

  const model = parsed.value.model ?? DEFAULT_MODEL
  await runStream(res, model, mockProducer(model, simulate), { ragged: true })
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
    if (typeof model !== 'string' || !isKnownModel(model)) {
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

function readSimulate(req: Request): SimulateMode | undefined {
  if (!config.allowSimulate) return undefined
  const raw = req.query['simulate']
  return isSimulateMode(raw) ? raw : undefined
}
