import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '..', 'dist')

const PORT = Number(process.env.PORT ?? 8787)
const isProduction = process.env.NODE_ENV === 'production'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

// Неизвестный маршрут под /api — это ошибка API, а не повод отдать страницу.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Маршрут не найден' } })
})

if (isProduction) {
  app.use(express.static(distDir))
  // SPA-фолбэк. Не app.get('*'): в Express 5 такой путь больше не разбирается.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  const mode = isProduction ? 'production' : 'development'
  console.log(`[server] ${mode}, слушает http://localhost:${PORT}`)
})
