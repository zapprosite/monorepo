# Frontend Rules

## Stack
- React 19 + Vite 7 + React Router 7
- TanStack Query + tRPC Client
- React Hook Form + Zod
- Zustand (global state)
- MUI via @connected-repo/ui-mui

## React 19 Rules
- Minimize useEffect
- Use use() for promises
- Use Suspense for data fetching
- Prefer direct calculations over state sync

## Modules
- Self-contained (pages, routes, components)
- NO cross-module imports
- Use React.lazy() for pages

## Import Rules
```typescript
// Direct imports (tree-shaking)
import { Button } from '@connected-repo/ui-mui/form/Button'

// Never barrel imports
// import { Button } from '@connected-repo/ui-mui' ❌
```

## Naming
- Pages: `<Name>.<module>.page.tsx`
- Components: `<Name>.<module>.tsx`

## Forms
- Always use Zod resolver
- Use formState for loading/error/dirty states
- Reset after submit
- Handle backend errors with setError()

## State
- Server state: tRPC + TanStack Query
- Form state: React Hook Form
- Global state: Zustand
- URL state: React Router

## Design
- Beautiful, responsive UI
- Mobile-first (44px touch targets)
- Smooth transitions (200-300ms)
- Theme tokens, not hardcoded values

## Adding Features
- Follow backend router structure
- Create matching module in apps/web/src/modules/
- Use lazy loading for pages
