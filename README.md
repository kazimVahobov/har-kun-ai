# har-kun-ai

Streaming LLM chat — React + TypeScript, Node proxy keeps the key off the client, cancellable
generation, keyboard-first.

> Work in progress. The mock server and the streaming core are in; the UI is next.
> Plan and decisions live in [`docs/`](docs/).
>
> The app's own interface is in Russian — the assignment arrived in Russian and will be reviewed
> in Russian ([ADR 0005](docs/adr/0005-no-localization.md)). Everything else here is English.

## Running it

Node ≥ 20.19 (tested on 22).

```bash
npm install
npm run dev
```

Open http://localhost:5173.

**No OpenRouter key is needed.** It is only required in phase 3, when the live model is wired up.
Until then the project runs on a mock and needs no secrets at all
([ADR 0003](docs/adr/0003-mock-first.md)).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite on :5173 and the backend on :8787, `/api` proxied |
| `npm test` | Vitest |
| `npm run build` | typecheck and build into `dist/` |
| `npm start` | production: one server serves both `dist/` and `/api` |
| `npm run typecheck` | types only, client and server |

Environment variables are in [`.env.example`](.env.example).

## Trying the edge cases

The mock reproduces on demand what a free model only produces by luck. Outside production,
`POST /api/chat` accepts `?simulate=`:

| Value | What happens |
|---|---|
| `429` | rate-limited before the stream starts, with `Retry-After` |
| `timeout` | the connection stays open and no first token arrives |
| `drop` | the connection dies mid-stream, with no `done` |
| `mid-error` | part of the answer, then an `error` event |
| `slow` | 300–800 ms between chunks |

```bash
curl -sN -X POST 'localhost:8787/api/chat?simulate=mid-error' \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

The timeout guard defaults to 30 s; shorten it to see it fire:
`TIMEOUT_FIRST_TOKEN_MS=2000 npm run dev:server`.

## Documentation

| File | About |
|---|---|
| [`docs/plan.md`](docs/plan.md) | phased plan and the `/api/chat` contract |
| [`docs/ui-structure.md`](docs/ui-structure.md) | screen layout, states, keyboard |
| [`docs/design-system.md`](docs/design-system.md) | the Nocturne design system: tokens and how they map on |
| [`docs/adr/`](docs/adr/) | decisions, with context and cost |
| [`docs/progress/`](docs/progress/) | per-task reports, including the AI log |

## License

[MIT](LICENSE)
