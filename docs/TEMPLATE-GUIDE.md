# Template Guide

**Generated:** 2026-04-26
**Template:** enterprise-template-v2

---

## Overview

This monorepo includes templates for creating new apps and packages following enterprise standards.

## When to Use Templates

| Scenario | Use |
|----------|-----|
| New API service | `template/app/` |
| New shared library | `template/packages/` |
| Standalone project | Create outside monorepo |

---

## Creating a New App

### 1. Copy the Template

```bash
# Copy app template to new app directory
cp -r template/app apps/my-new-app
```

### 2. Update Configuration

Edit `apps/my-new-app/package.json`:
- Update `name` to `@repo/my-new-app`
- Update `description`

Edit `apps/my-new-app/README.md`:
- Update description and structure

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Start Development

```bash
pnpm --filter @repo/my-new-app dev
```

---

## Creating a New Package

### 1. Copy the Template

```bash
# Copy package template to new package directory
cp -r template/packages packages/my-new-package
```

### 2. Update Configuration

Edit `packages/my-new-package/package.json`:
- Update `name` to `@repo/my-new-package`
- Update `description`

### 3. Implement

Add your package code to `src/index.ts`.

### 4. Export from Consumers

In any app/package that needs your new package:

```bash
pnpm add @repo/my-new-package
```

Or edit `package.json` and use workspace protocol:
```json
"@repo/my-new-package": "workspace:*"
```

---

## Template Structure

```
template/
├── app/                      # App template
│   ├── README.md            # App documentation
│   ├── CLAUDE.md            # Claude Code instructions
│   ├── package.json         # App boilerplate
│   └── .github/workflows/ci.yml
│
└── packages/                 # Package template
    ├── README.md            # Package documentation
    ├── CLAUDE.md            # Claude Code instructions
    ├── package.json         # Package boilerplate
    └── .github/workflows/ci.yml
```

---

## Guidelines

### Do

- Use Zod schemas from `packages/zod-schemas` for validation
- Follow language standards (EN for code, PT-BR for docs)
- Use Conventional Commits for commit messages
- Add CLAUDE.md to new projects

### Don't

- Duplicate functionality that exists in other packages
- Add runtime dependencies without approval
- Bump package versions manually (use central versioning)

---

## Monorepo vs Standalone

| Factor | Monorepo | Standalone |
|--------|----------|------------|
| Shared code | ✅ Easy via workspace | ❌ Manual copying |
| CI/CD | ✅ Centralized | ✅ Per-repo |
| Dependencies | ✅ Deduplicated | ❌ Duplicated |
| Coordination | ✅ Central | ❌ No |

**Choose monorepo** when:
- Code will be shared between projects
- You want centralized dependency management
- You need unified CI/CD

**Choose standalone** when:
- Project is truly independent
- Different team ownership
- Different release cycle required

---

**Template:** enterprise-template-v2
