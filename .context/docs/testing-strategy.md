# Testing Strategy

This document outlines the multi-layered testing strategy used to maintain quality and reliability across the monorepo. Our approach combines static analysis, isolated unit tests, and integrated functional tests to ensure that every change—from a Zod schema modification to an AI-agent orchestrator update—is validated before reaching production.

## Overview

Quality is enforced through automated pipelines that run on every Pull Request. This ensures that regressions are caught early and that the contract between the frontend and backend (via tRPC and Zod schemas) remains intact.

### Core Testing Principles
- **Type Safety**: Leverage TypeScript and Zod for compile-time and runtime validation.
- **Isolation**: Unit tests must not depend on external services (databases, APIs).
- **Reproducibility**: Integration tests must use clean database states using teardown utilities.
- **Automation**: No code is merged without passing the CI suite.

---

## Test Hierarchy

### 1. Unit Tests
Focus on pure functions, utility methods, and isolated components.
- **Tools**: Vitest, `@testing-library/react`.
- **Primary Locations**: 
    - `packages/zod-schemas/src/__tests__`: Logic for validating inputs like `UserCreateInput` or `AddressCreateInput`.
    - `apps/api/src/utils`: Backend utility logic such as `ip-checker.utils.ts`.
    - `packages/ui/src/components`: Rendering tests for atomic UI components.
- **Example**: Verifying that `areSameSubnet` correctly identifies IP ranges or validating that `UserCreateInput` rejects invalid email formats.

### 2. Integration Tests
Validate that multiple units (routers, services, and databases) work together.
- **Tools**: Vitest, tRPC Callers, Database Migrations.
- **Scope**:
    - **tRPC Procedures**: Ensuring `AppTrpcRouter` correctly handles requests across modules like `auth`, `kanban`, and `contracts`.
    - **Middleware**: Testing the behavior of `validateSessionSecurity` or `authMiddleware` within the request lifecycle.
    - **Database Access**: Verifying CRUD operations on Drizzle tables (e.g., `UserTable`, `EquipmentTable`).
- **Example**: Creating a maintenance plan in `apps/api/src/modules/maintenance` and verifying the record persists in `MaintenancePlansTable`.

### 3. End-to-End (E2E) & Smoke Tests
Validate critical user journeys and agent orchestrations.
- **Tools**: Playwright (UI), Python/Pytest (AI/RAG).
- **Location**: `apps/web/e2e` or `scripts/hvac-rag/tests`.
- **Scope**:
    - Authentication flows (Google OAuth2 via `google-oauth2.auth.plugin.ts`).
    - AI RAG pipeline validation (verifying `build_rag_context` effectively retrieves HVAC data).
    - Complex interactions like Kanban board drag-and-drop.

---

## Running Tests

Tests can be executed globally from the root using Yarn or individually within each workspace.

### Global Execution
```bash
# Run all tests across the monorepo
yarn test

# Run linting and type checking
yarn lint
yarn typecheck
```

### Workspace Specific
```bash
# Web Application
yarn workspace @connected-repo/web test

# API (Watch Mode)
yarn workspace @connected-repo/api test --watch

# AI Gateway
yarn workspace @connected-repo/ai-gateway test
```

### Targeted Execution
To speed up development, run a specific test file:
```bash
npx vitest apps/api/src/modules/auth/__tests__/session.test.ts
```

---

## Quality Gates

The following requirements must be met before merging any Pull Request:

| Category | Requirement | Target |
| :--- | :--- | :--- |
| **Logic Coverage** | Core logic in `apps/api/src/modules` | > 80% |
| **Schema Coverage** | Shared schemas in `packages/zod-schemas` | 100% |
| **Static Analysis** | Linting and formatting checks | 0 Errors |
| **Type Safety**| TypeScript compilation | Success |
| **CI Pipeline** | GitHub Actions Pipeline | Pass |

---

## Troubleshooting & Best Practices

### Database State Management
Integration tests often fail due to unique constraint violations (e.g., `email` in `UserTable`). 
- **Solution**: Use the standardized database initialization helpers located in `apps/api/src/test-utils`. Always ensure a clean state by using `beforeEach` hooks to reset table data where applicable.

### Mocking External Dependencies
- **Browser APIs**: When testing UI components that use `ResizeObserver` or `IntersectionObserver`, provide mocks in a `vitest.setup.ts` file.
- **AI Providers**: Mock LLM responses in HVAC/RAG scripts to avoid non-deterministic results and unnecessary API costs. Use `vi.mock` for external service clients.

### Testing tRPC Procedures
Use the specialized `trpcQuery` or `trpcMutation` helpers found in the API test suite. These simulate the tRPC v11 protocol:
```typescript
// Example from apps/api/src/__tests__/trpc-http.test.ts
const response = await trpcQuery(app, 'user.getById', { id: '123' });
```

### State Machine & Async Logic
For flows involving complex intervals or timeouts:
- Use `vi.useFakeTimers()` to handle time-dependent logic.
- Ensure all database sessions or file streams are closed in `afterAll` blocks to prevent the test runner from hanging.

---

**Related Documentation:**
- [Development Workflow](./development-workflow.md)
- [API Architecture](../apps/api/README.md)
