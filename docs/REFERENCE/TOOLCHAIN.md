# Toolchain Reference

> **Purpose:** All toolchain commands for the monorepo — npm/pnpm/bun, Node.js, Python, bash scripts.
> **Location:** `/srv/monorepo/docs/TOOLCHAIN.md`
> **Runtime:** Node.js >=22, pnpm@9.0.0, Turbo 2.x, Bun (for `@leogomide/multi-claude` CLI)

---

## 1. Node.js / Package Manager

The monorepo uses **pnpm@9.0.0** as package manager (per `packageManager` field) and **Turbo** for workspace orchestration.

### Package Manager Commands

```bash
# Install all workspace dependencies
pnpm install

# Add a dependency to a specific workspace
pnpm workspace @repo/api add zod
pnpm workspace @repo/web add react

# Run a script in a specific workspace
pnpm workspace @repo/api run dev

# Remove a dependency
pnpm workspace @repo/web remove some-package
```

### Monorepo Scripts (from package.json)

```bash
# Build all workspaces (runs env:sync first)
pnpm build

# Development mode (runs env:sync first, then turbo dev)
pnpm dev

# Lint all workspaces
pnpm lint

# Type check all workspaces
pnpm check-types

# Run tests across all workspaces
pnpm test

# Format code with Biome
pnpm format

# Database operations (workspace-specific)
pnpm db

# Clean everything (node_modules, .pnpm/cache, then turbo clean)
pnpm clean
```

### Environment Sync

```bash
# Sync environment variables to workspaces before build/dev
node scripts/sync-env.js
pnpm env:sync
```

---

## 2. Turbo (Workspace Orchestration)

```bash
# Run build in all workspaces
turbo run build

# Run dev in all workspaces (parallel)
turbo run dev

# Run lint in all workspaces
turbo run lint

# Run test in all workspaces
turbo run test

# Run a specific task
turbo run build --filter=@repo/api

# Dry run (see what would run without executing)
turbo run build --dry-run

# Force rebuild
turbo run build --force
```

---

## 3. Biome (Formatting & Linting)

```bash
# Format all files (writes in place)
pnpm format

# Check formatting without writing
biome format .

# Lint with auto-fix
biome lint --write .

# Check all (format + lint + import order)
biome check .

# Fix all issues
biome check --write .
```

---

## 4. TypeScript

```bash
# Type check all workspaces (via turbo)
pnpm check-types

# Type check a specific workspace
cd apps/api && npx tsc --noEmit

# Full tsc with alias resolution
npx tsc-alias
```

---

## 5. Testing

```bash
# All workspaces
pnpm test

# Specific workspace
pnpm workspace @repo/api run test

# With Playwright (if installed)
npx playwright test
npx playwright test --project=chromium
npx playwright test --project=chromium --headed
```

---

## 6. Git / Version Control

```bash
# Stage and commit all changes
git add -A
git commit -m "feat(scope): description"

# Push to origin
git push origin HEAD

# Push to both remotes (Gitea + GitHub)
bash /srv/monorepo/scripts/mirror-push.sh

# Create a feature branch
git checkout -b feature/my-feature
git push -u origin feature/my-feature

# Squash and merge
git checkout main && git merge --squash feature/my-feature && git commit

# Tags
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
git tag -d latest && git push origin --delete latest && git tag -a latest -m "Latest release" && git push origin latest
```

---

## 7. Python Environments

```bash
# Check Python version
python3 --version

# Create virtual environment (if project uses Python)
python3 -m venv .venv
source .venv/bin/activate

# Install from requirements.txt (if present)
pip install -r requirements.txt

# Run Python script
python3 scripts/some-script.py
```

---

## 8. Bash Scripts in /scripts

All operational scripts live in `/srv/monorepo/scripts/`.

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `health-check.sh` | Full monorepo health check (services + ZFS + disk) | `bash /srv/monorepo/scripts/health-check.sh` |
| `deploy.sh` | Pre-deploy validation + snapshot + push | `bash /srv/monorepo/scripts/deploy.sh` |
| `backup.sh` | Backup all monorepo data and configs | `bash /srv/monorepo/scripts/backup.sh` |
| `restore.sh` | Restore from backup | `bash /srv/monorepo/scripts/restore.sh <backup-name>` |
| `mirror-push.sh` | Push to Gitea and GitHub simultaneously | `bash /srv/monorepo/scripts/mirror-push.sh` |
| `sync-env.js` | Sync environment variables to workspaces | `node scripts/sync-env.js` |

### Pre-Built Cron Entries

```cron
# Health check every 30 minutes
*/30 * * * * bash /srv/monorepo/scripts/health-check.sh >> /srv/ops/logs/health-check.log 2>&1

# Backup daily at 3am
0 3 * * * bash /srv/monorepo/scripts/backup.sh >> /srv/ops/logs/backup.log 2>&1
```

---

## 9. Docker / Container Health (from guide.md)

```bash
# List running containers
docker ps

# Platform services status
docker compose -f /srv/apps/platform/docker-compose.yml ps

# Check specific service health
curl http://localhost:6333/health          # Qdrant
curl http://localhost:5678/api/v1/health   # n8n

# View logs
docker logs qdrant --tail 50
docker logs n8n --tail 50
docker logs n8n-postgres --tail 20

# Restart a service
docker restart qdrant

# Resource usage
docker stats --no-stream
```

---

## 10. ZFS (from guide.md)

```bash
# Pool status
zpool status tank

# List datasets
zfs list | grep tank

# Create snapshot (before any risky operation!)
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)

# List snapshots
zfs list -t snapshot

# Rollback (last resort)
sudo zfs rollback -r tank@<snapshot-name>

# Scrub (check for errors)
zpool scrub tank
```

---

## 11. Service-Specific Health Checks

```bash
# Qdrant vector DB
curl http://localhost:6333/health

# n8n workflow engine
curl http://localhost:5678/api/v1/health

# PostgreSQL (n8n)
docker exec n8n-postgres pg_isready -U n8n

# Ollama (systemd)
curl http://localhost:11434/api/tags

# LiteLLM proxy
curl http://localhost:4000/health

# Disk space
df -h /srv
```

---

## 12. Quick Reference Card

```bash
# Development
pnpm dev              # Start all workspaces
pnpm build            # Build all
pnpm lint             # Lint all
pnpm test             # Test all

# Code quality
pnpm format           # Format with Biome
pnpm check-types      # TypeScript check

# Git
git add -A && git commit -m "feat: description"  # Commit
bash scripts/mirror-push.sh                      # Push to both remotes

# System health
bash scripts/health-check.sh                     # Full health check
bash scripts/backup.sh                           # Backup everything
```

---

**Last updated:** 2026-04-08
**Maintainer:** will
