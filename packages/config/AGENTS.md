# AGENTS.md — packages/config

> 🦍 Leia: [CONTRACT.md](../../homelab-context/CONTRACT.md) — Modo Gorila: direto, focado, token-efficient.

`@repo/typescript-config` — Shared TypeScript configuration presets: base,
library, react-library, and vite. Extended by all other packages/apps via
`"extends": "@repo/typescript-config/base.json"`. Sets strict mode, ESNext
module resolution, and declaration maps across the monorepo.
