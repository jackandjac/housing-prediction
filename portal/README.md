# portal

Next.js 16 (App Router) portal hosting the Property Value Estimator, Property Market Analysis and Model Studio apps.
See the [root README](../README.md#task-2-multi-application-portal) for architecture and how to run the whole stack.

```bash
npm ci
npm run dev          # needs the backends; ESTIMATOR_API_URL, MARKET_API_URL, ML_API_URL (defaults: 127.0.0.1:8001/8080/8000)
                     # MODEL_ADMIN_TOKEN=… enables training and model switching in Model Studio
npm run lint && npm run typecheck && npm test
```

| Path | Contents |
|---|---|
| `app/` | Routes: `/`, `/estimator/*`, `/market/*`, `/models/*`, and the backend proxies in `app/api/*` |
| `components/ui` | Design-system components (Button, Card, Field, Badge, Alert, Skeleton, …) |
| `components/{estimator,market,models,charts,layout}` | App components |
| `hooks/` | Shared custom hooks (TanStack Query, zustand, URL state) |
| `lib/server/` | Server-only backend fetchers and the proxy |
| `lib/` | Types, formatting, error normalisation, zod schema builder, URL filter helpers (+ tests) |
