# har-kun-ai

Streaming LLM chat — React + TypeScript, Node proxy keeps the key off the client, cancellable
generation, keyboard-first.

> Проект в работе. Сейчас поднят каркас: страница и `/api/health`.
> План и решения — в [`docs/`](docs/).

## Запуск

Нужен Node ≥ 20.19 (проверено на 22).

```bash
npm install
npm run dev
```

Открыть http://localhost:5173 — страница должна показать, что `/api/health` отвечает.

Ключ OpenRouter **не нужен**: он понадобится только в фазе 3, когда подключится живая модель.
До этого проект поднимается и работает без секретов ([ADR 0003](docs/adr/0003-mock-first.md)).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Vite на :5173 и бэкенд на :8787, `/api` проксируется |
| `npm run build` | проверка типов и сборка в `dist/` |
| `npm start` | прод-режим: тот же сервер отдаёт и `dist/`, и `/api` |
| `npm run typecheck` | только проверка типов, клиент и сервер |

Переменные окружения — в [`.env.example`](.env.example).

## Документация

| Файл | О чём |
|---|---|
| [`docs/plan.md`](docs/plan.md) | план по фазам и контракт `/api/chat` |
| [`docs/ui-structure.md`](docs/ui-structure.md) | раскладка экрана, состояния, клавиатура |
| [`docs/design-system.md`](docs/design-system.md) | дизайн-система Nocturne: токены и перенос |
| [`docs/adr/`](docs/adr/) | принятые решения с контекстом и ценой |
| [`docs/progress/`](docs/progress/) | отчёты по задачам, включая ИИ-лог |

## Лицензия

[MIT](LICENSE)
