import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { handleChat } from './chat.js'
import { assertConfigured, config } from './env.js'
import { handleModels, warmCatalogue } from './models.js'

// Before anything binds a port: a server that is not configured should say so
// and stop, not look healthy and fail on the first question somebody asks.
assertConfigured()

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '..', 'dist')

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

app.get('/api/models', handleModels)
app.post('/api/chat', handleChat)

// An unknown route under /api is an API error, not a reason to serve the page.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Маршрут не найден' } })
})

if (config.isProduction) {
  app.use(express.static(distDir))
  // SPA fallback. Not app.get('*'): Express 5 no longer parses that path.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(config.port, () => {
  const mode = config.isProduction ? 'production' : 'development'
  const source = config.useMock ? 'mock' : 'OpenRouter'
  console.log(`[server] ${mode}, ${source}, listening on http://localhost:${config.port}`)
  warmCatalogue()
})
