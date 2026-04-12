# Version Lock — 2026-04-12

Critical tool versions pinned for homelab-monorepo.

| Tool | Version | Source |
|------|---------|--------|
| Turbo | 2.9.6 | CLAUDE.md / package.json |
| pnpm | 9.0.x | CLAUDE.md |
| Node.js | (check .nvmrc or package.json) | local |
| Claude Code CLI | 2.1.89 | research 2026-04-11 |

## Update Policy

AI agents CANNOT update pinned components without:
1. Research via Context7/Tavily
2. Explicit approval from will-zappro
3. Version bump in this file + git commit

## Verification

```bash
pnpm --version  # should be 9.x
turbo --version  # should be 2.9.6
```
