import { useEffect, useState } from 'react'

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; uptime: number }
  | { kind: 'error'; message: string }

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = (await response.json()) as { uptime: number }
        setHealth({ kind: 'ok', uptime: body.uptime })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setHealth({ kind: 'error', message: error instanceof Error ? error.message : 'сбой' })
      })

    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>har kun ai</h1>
      <p>Каркас поднят. Интерфейс — фаза 2.</p>
      <p>
        <code>/api/health</code>: {describe(health)}
      </p>
    </main>
  )
}

function describe(health: HealthState): string {
  switch (health.kind) {
    case 'loading':
      return 'проверяем…'
    case 'ok':
      return `отвечает, сервер живёт ${health.uptime} с`
    case 'error':
      return `не отвечает (${health.message})`
  }
}
