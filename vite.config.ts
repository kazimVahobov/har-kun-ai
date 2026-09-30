import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  /**
   * Read through `loadEnv` rather than `process.env`: Vite does not put `.env`
   * into the process environment, so a `PORT` set in that file was invisible
   * here — the backend moved and the dev proxy kept pointing at 8787.
   *
   * The prefix is `PORT` and not `''` on purpose. `''` would load every key in
   * the file, the OpenRouter one included, into this config's scope — one
   * careless `define` away from the bundle. Nothing that must not reach the
   * browser is ever read here (ADR 0002).
   */
  const { PORT } = loadEnv(mode, process.cwd(), 'PORT')
  const serverPort = PORT === undefined || PORT === '' ? '8787' : PORT

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // The browser only ever talks to its own origin — the key lives on the server (ADR 0002).
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
