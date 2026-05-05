# CLAUDE.md — App Template

## Project Overview

<!-- Describe your app -->

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22+ |
| Language | TypeScript (strict) |
| Framework | Fastify + tRPC |
| Validation | Zod |
| Formatting | Biome |

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests |
| `pnpm typecheck` | TypeScript validation |
| `pnpm lint` | Lint code |

## Conventions

- **Language:** PT-BR for docs, EN for code
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`)
- **Types:** No `any` — use `unknown` and narrow

## Architecture

```
src/
├── routes/      # tRPC routers
├── services/    # Business logic
├── schemas/     # Zod schemas from packages/zod-schemas
└── index.ts     # App entry
```

## Important Files

- `src/index.ts` — App entry point
- `.env.example` — Environment template (copy and configure)

---

**Template:** enterprise-template-v2
