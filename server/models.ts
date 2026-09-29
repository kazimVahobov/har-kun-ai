import type { Request, Response } from 'express'
import type { ModelsResponse } from '../shared/contract.js'
import { DEFAULT_MODEL, MOCK_MODELS } from './mock.js'

export function handleModels(_req: Request, res: Response): void {
  const body: ModelsResponse = { models: MOCK_MODELS, default: DEFAULT_MODEL }
  res.json(body)
}
