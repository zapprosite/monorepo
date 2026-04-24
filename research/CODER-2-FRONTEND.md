# CODER-2-FRONTEND Research Report

**Date:** 2026-04-23
**Agent:** CODER-2
**Focus:** Frontend Design Best Practices
**Monorepo Path:** `/srv/monorepo`

---

## 1. Current Architecture Summary

### 1.1 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | React + Vite | 19.2.0 / 7.1.12 |
| **Routing** | React Router | 7.9.4 |
| **Data Fetching** | TanStack Query + tRPC Client | 5.90.5 / 11.7.0 |
| **Forms** | React Hook Form + Zod | 7.66.0 / 3.51.4 |
| **State** | tRPC (server), React Router context (auth) | — |
| **UI Library** | MUI via `@repo/ui-mui` | 7.3.4 |
| **Tables** | Material React Table | 3.2.1 |
| **Error Handling** | react-error-boundary | 6.0.0 |

### 1.2 Directory Structure

```
apps/web/
├── src/
│   ├── App.tsx                      # Root component with providers
│   ├── main.tsx                     # Entry point, QueryClientProvider
│   ├── router.tsx                   # React Router configuration
│   ├── components/                  # Shared components
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx        # Responsive shell (mobile/desktop)
│   │   │   ├── DesktopNavbar.tsx
│   │   │   └── MobileNavbar.tsx
│   │   └── error_fallback.tsx
│   ├── configs/
│   │   └── env.config.ts            # Zod-validated env vars
│   ├── contexts/
│   │   └── UserContext.tsx          # Session state via Outlet context
│   ├── modules/                     # Feature modules (self-contained)
│   │   ├── auth/
│   │   ├── journal-entries/
│   │   ├── clients/
│   │   ├── leads/
│   │   ├── contracts/
│   │   ├── equipment/
│   │   ├── schedule/
│   │   ├── service-orders/
│   │   ├── editorial/
│   │   ├── reminders/
│   │   ├── kanban/
│   │   ├── email/
│   │   ├── loyalty/
│   │   ├── maintenance/
│   │   ├── rag/
│   │   └── settings/
│   ├── pages/                       # Shared pages
│   │   └── Dashboard.page.tsx
│   └── utils/
│       ├── queryClient.ts           # TanStack Query instance
│       ├── trpc.client.ts           # tRPC client factory
│       └── auth.loader.ts           # Route protection loader
```

### 1.3 Module Pattern

Each module follows a consistent structure:
```
modules/<name>/
├── <name>.router.tsx           # Route definitions (lazy loaded)
├── components/                 # Module-specific components
│   └── *.tsx
└── pages/
    ├── <Name>.page.tsx         # List/detail pages
    └── Create<Name>.page.tsx   # Create pages
```

**Key Rules (from CLAUDE.md):**
- Self-contained modules (no cross-module imports)
- React.lazy() for all page components
- Direct category imports (no barrel imports)

### 1.4 Component Library (`@repo/ui-mui`)

```
packages/ui/
├── src/
│   ├── components/      # Custom: ContentCard, ErrorAlert, LoadingSpinner
│   ├── data-display/   # MUI re-exports: Typography, Chip, Avatar, Badge
│   ├── feedback/       # MUI: CircularProgress, Dialog, Snackbar, Skeleton
│   ├── form/           # MUI: Button, TextField, Select, Checkbox, Switch
│   ├── icons/          # Icon components
│   ├── layout/         # MUI: Box, Stack, Grid, Container, Paper, Card
│   ├── mrt/            # Material React Table wrapper
│   ├── navigation/     # MUI: AppBar, BottomNavigation, Pagination
│   ├── rhf-form/        # React Hook Form integrations
│   │   ├── RhfTextField.tsx
│   │   ├── RhfSelect.tsx
│   │   ├── RhfCheckbox.tsx
│   │   ├── RhfSwitch.tsx
│   │   ├── RhfFormProvider.tsx
│   │   └── useRhfForm.tsx
│   └── theme/           # ThemeContext, ThemeProvider, theme.config
```

---

## 2. Best Practices (April 2026)

### 2.1 React 19 Patterns

**Already Implemented:**
- `React.lazy()` for all page components
- `Suspense` boundaries with fallback
- `ErrorBoundary` at top level
- Dark/light theme via `ThemeContextProvider`

**Observed in Codebase:**

```typescript
// apps/web/src/router.tsx - Lazy loading
const DashboardPage = lazy(() => import("@frontend/pages/Dashboard.page"))

// apps/web/src/App.tsx - Proper nesting
<ThemeContextProvider>
  <Suspense fallback={<LoadingSpinner />}>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </Suspense>
</ThemeContextProvider>
```

### 2.2 Data Fetching Patterns

**tRPC + TanStack Query Integration:**

```typescript
// utils/trpc.client.ts - Factory pattern
export const trpc = createTRPCOptionsProxy<AppTrpcRouter>({
  client: trpcFetch,
  queryClient,
});

// Usage in components
const { data, isLoading } = useQuery(trpc.journalEntries.getAll.queryOptions())
```

### 2.3 Form Handling

**RhfFormProvider Pattern (from `packages/ui/src/rhf-form/RhfFormProvider.tsx`):**

```typescript
<RhfFormProvider
  formMethods={formMethods}
  onSubmit={handleSubmit}
  errorDisplayer={{ show: true }}
  numLockAlert={true}
>
  <RhfTextField name="email" />
  <RhfSubmitButton />
</RhfFormProvider>
```

### 2.4 Auth Flow

**Loader-based authentication:**

```typescript
// utils/auth.loader.ts
export async function authLoader({ context }) {
  const sessionInfo = await queryClient.fetchQuery(
    trpc.auth.getSessionInfo.queryOptions()
  );
  context.set(userContext, sessionInfo);
  return sessionInfo;
}
```

**Session passed via React Router context to `AppLayout`:**

```typescript
// components/layout/AppLayout.tsx
const sessionInfo = useLoaderData() as SessionInfo;
// Passed to children via Outlet context
<Outlet context={sessionInfo} />
```

### 2.5 Responsive Design

**Mobile-first with MUI breakpoints:**

```typescript
// AppLayout.tsx
const isMobile = useMediaQuery(theme.breakpoints.down("md"));

// Responsive spacing
sx={{ pt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4 } }}
```

### 2.6 Animation Standards

**Status (from CLAUDE.md):**
- Transition durations defined: 200-300ms for micro-interactions
- Cards with hover lift effect
- Fade transitions for modals

**Not consistently applied:**
- Some components lack hover transitions
- No skeleton screens for async content (LoginPage uses full spinner)

---

## 3. Gaps and Issues Found

### 3.1 Missing Components in `@repo/ui-mui`

**Critical missing components identified:**

| Component | Usage Found | Location |
|-----------|-------------|----------|
| `StatusBadge` | Scattered per-module | leads, contracts, editorial, equipment, reminders, schedule, service-orders |
| `EmptyState` | In components/ | JournalEntriesEmptyState.tsx |
| `LoadingCard` | Not found | — |
| `SkeletonScreen` | Not found | Uses CircularProgress instead |

**Current StatusBadge pattern (leads):**
```typescript
// apps/web/src/modules/leads/components/LeadStatusBadge.tsx
// Hardcoded color mapping per status - should be centralized
```

### 3.2 Inconsistent State Management

**CLAUDE.md mentions Zustand for global state:**
```
State
- Server state: tRPC + TanStack Query
- Form state: React Hook Form
- Global state: Zustand
```

**Actual usage:**
- No Zustand stores found in frontend
- Global state via React Router context (`UserContext`)
- Session data passed through loader context

**Gap:** If global UI state needed (e.g., notifications, theme persistence), no Zustand implementation exists.

### 3.3 Material React Table Usage

**Finding:** MRT is used but no shared wrapper in `@repo/ui-mui`

```typescript
// Direct import in journal entries
import { MaterialReactTable } from 'material-react-table';
// MRT v3 config scattered across pages
```

**Gap:** Should have `packages/ui/src/mrt/MaterialReactTable.tsx` wrapper with default configuration.

### 3.4 Loading State Inconsistency

**Login page (auth-callback.html):** Full-page spinner approach for OAuth callback.

**JournalEntries page:** Uses `LoadingSpinner` component.

**Gap:** No skeleton loading patterns implemented despite CLAUDE.md mentioning them.

### 3.5 No Frontend Documentation in `/srv/monorepo/docs/`

**Search result:** No frontend or design-specific docs found in `/srv/monorepo/docs/`

**Content available:**
- `docs/ARCHITECTURE.md` - Backend/system architecture
- `docs/ADRs/` - Architecture Decision Records
- `docs/SPECS/` - Feature specifications
- `docs/GUIDES/` - Operational guides

**Gap:** No dedicated frontend design guide, component documentation, or UI patterns guide.

---

## 4. Recommendations for Improvement

### 4.1 Immediate Actions

#### A. Add Missing Shared Components to `@repo/ui-mui`

```typescript
// packages/ui/src/components/StatusBadge.tsx
export const StatusBadge = ({ status, ...props }) => (
  <Chip
    label={status}
    sx={{
      bgcolor: statusColors[status].bg,
      color: statusColors[status].text,
    }}
    {...props}
  />
);

// packages/ui/src/components/EmptyState.tsx
export const EmptyState = ({ icon, title, description, action }) => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <Typography variant="h6">{title}</Typography>
    {/* ... */}
  </Box>
);

// packages/ui/src/components/SkeletonCard.tsx
export const SkeletonCard = () => (
  <Card sx={{ p: 3 }}>
    <Skeleton variant="rectangular" height={200} />
    <Skeleton />
  </Card>
);
```

#### B. Create Shared MRT Wrapper

```typescript
// packages/ui/src/mrt/MaterialReactTable.tsx
export const AppMaterialReactTable = ({ ...props }) => (
  <MaterialReactTable
    enablePagination
    muiTableBodyRowProps={{ hover: true }}
    // ... shared defaults
    {...props}
  />
);
```

### 4.2 Medium-term Improvements

#### A. Document Frontend Architecture

Create `/srv/monorepo/docs/FRONTEND.md`:

```markdown
# Frontend Architecture

## Tech Stack
- React 19 + Vite 7
- React Router 7 (file-based routing via router.tsx)
- TanStack Query + tRPC Client
- MUI via @repo/ui-mui

## Component Library
See `@repo/ui-mui/README.md`

## Module Structure
Each feature module is self-contained under `apps/web/src/modules/<name>/`
- No cross-module imports
- Shared components in `apps/web/src/components/`

## State Management
- Server state: tRPC + TanStack Query
- Form state: React Hook Form + Zod
- Auth state: React Router loaders + context

## Design System
- Mobile-first (44px touch targets)
- Breakpoints: xs(0) sm(600) md(900) lg(1200) xl(1536)
- Transitions: 200-300ms for micro, 300-400ms for page
```

#### B. Add Skeleton Loading

Replace full-page spinners with skeleton screens:

```typescript
// In components that load data
{isLoading ? (
  <SkeletonCard />
) : (
  <Content />
)}
```

#### C. Implement Zustand for Global UI State (if needed)

**Use case:** Toast notifications, modals, UI flags

```typescript
// store/ui.ts
import { create } from 'zustand';

interface UIState {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, toast]
  })),
}));
```

### 4.3 Code Quality Recommendations

| Area | Current | Recommendation |
|------|---------|----------------|
| **Imports** | Direct category imports | Already enforced, continue |
| **Lazy loading** | All pages lazy | Continue pattern |
| **Error boundaries** | One global | Consider per-module boundaries |
| **Theme tokens** | Using `theme.palette.*` | Continue, avoid hardcoded colors |
| **Responsive** | Mobile-first | Continue, ensure all components |
| **Animations** | Scattered | Create animation constants file |

### 4.4 Performance Optimizations

**Already Implemented:**
- Chunk splitting (react-vendor, mui-vendor, zod-vendor, query-vendor)
- Tree-shaking via direct imports
- Lazy loading all pages

**Additional recommendations:**
1. Add `React.memo()` for expensive list item components
2. Consider virtualization for large lists (react-window)
3. Add service worker for offline support (PWA)

---

## 5. Summary

### Strengths
- Excellent module structure with clear separation of concerns
- Direct tree-shaking imports enforced
- React 19 patterns (Suspense, lazy, ErrorBoundary) properly implemented
- Theme system with light/dark mode support
- Form handling via RHF + Zod well integrated
- tRPC + TanStack Query integration follows best practices
- Responsive design with mobile-first approach

### Areas for Improvement
1. **Missing shared components:** StatusBadge, EmptyState, SkeletonCard should be centralized
2. **No skeleton loading:** Full-page spinners for content loading
3. **MRT wrappers:** Material React Table lacks shared configuration wrapper
4. **Documentation:** No frontend design docs in `/srv/monorepo/docs/`
5. **State management gap:** CLAUDE.md mentions Zustand but no stores exist

### Priority Actions
1. Add `StatusBadge`, `EmptyState`, `SkeletonCard` to `@repo/ui-mui`
2. Replace spinners with skeleton screens in data-heavy pages
3. Create `docs/FRONTEND.md` architecture document
4. Add MRT wrapper in `@repo/ui-mui`
5. Audit all pages for consistent hover transitions

---

**Report Generated:** 2026-04-23
**Research Duration:** ~30 minutes
**Files Analyzed:** 25+