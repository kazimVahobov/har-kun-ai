import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { handleChat } from './chat.js'
import { config } from './env.js'
import { handleModels } from './models.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '..', 'dist')

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

app.get('/api/models', handleModels)
app.post('/api/chat', handleChat)

// Неизвестный маршрут под /api — это ошибка API, а не повод отдать страницу.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Маршрут не найден' } })
})

if (config.isProduction) {
  app.use(express.static(distDir))
  // SPA-фолбэк. Не app.get('*'): в Express 5 такой путь больше не разбирается.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(config.port, () => {
  const mode = config.isProduction ? 'production' : 'development'
  const source = config.useMock ? 'мок' : 'живая модель'
  console.log(`[server] ${mode}, ${source}, слушает http://localhost:${config.port}`)
})
