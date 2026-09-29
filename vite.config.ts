import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SERVER_PORT = process.env.PORT ?? '8787'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser only ever talks to its own origin — the key lives on the server (ADR 0002).
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
