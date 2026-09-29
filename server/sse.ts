import type { Response } from 'express'
import type { ApiError, DeltaEvent, DoneEvent } from '../shared/contract.js'

/** A keepalive comment. The client parser must ignore such lines. */
export const KEEPALIVE = ':\n\n'

export function openStream(res: Response): void {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
}

export function deltaFrame(data: DeltaEvent): string {
  return frame('delta', data)
}

export function doneFrame(data: DoneEvent): string {
  return frame('done', data)
}

export function errorFrame(data: ApiError): string {
  return frame('error', data)
}

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * A write that respects backpressure: while the socket buffer is full, wait for
 * `drain`. It also resolves on `close` — otherwise on a broken connection the
 * promise would hang forever, and the generation loop with it.
 */
export function write(res: Response, chunk: string): Promise<void> {
  if (res.writableEnded || res.destroyed) return Promise.resolve()

  return new Promise((resolve) => {
    if (res.write(chunk)) {
      resolve()
      return
    }

    const finish = (): void => {
      res.off('drain', finish)
      res.off('close', finish)
      resolve()
    }

    res.once('drain', finish)
    res.once('close', finish)
  })
}
