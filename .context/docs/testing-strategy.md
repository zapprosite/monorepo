# Testing Strategy

This document outlines the multi-layered testing strategy used to maintain quality and reliability across the monorepo. Our approach combines static analysis, isolated unit tests, and integrated functional tests to ensure that every change—from a Zod schema modification to a AI-agent orchestrator update—is validated before reaching production.

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
    - `apps/api/src/utils`: Backend utility logic such as `ipChecker.utils.ts`.
    - `packages/ui/src/components`: Rendering tests for atomic UI components.
- **Example**: Verifying that `validateFile` in `hermes-agency` correctly identifies forbidden MIME types via magic bytes.

### 2. Integration Tests
Validate that multiple units (routers, services, and databases) work together.
- **Tools**: Vitest, tRPC Callers, Testcontainers (Postgres/Redis).
- **Scope**:
    - **tRPC Procedures**: Ensuring `AppTrpcRouter` correctly handles requests across modules like `auth`, `kanban`, and `contracts`.
    - **Middleware**: Testing the behavior of `apiKeyAuthHook` or `sessionSecurity.middleware.ts` within the Fastify request lifecycle.
    - **Database Access**: Verifying CRUD operations on Drizzle tables (e.g., `UsersTable`, `SubscriptionsTable`).
- **Example**: Creating a maintenance plan in `apps/api/src/modules/maintenance` and verifying the record persists in `MaintenancePlansTable`.

### 3. End-to-End (E2E) & Smoke Tests
Validate critical user journeys and agent orchestrations.
- **Tools**: Playwright (UI), Python/Pytest (AI Agents).
- **Location**: `apps/web/e2e` or `smoke-tests/`.
- **Scope**:
    - Authentication flows (Google OAuth2 via `google-oauth2.auth.plugin.ts`).
    - AI Orchestrator flows in `Hermes Agency` (e.g., verifying Telegram bot responsiveness in `smoke_hermes_telegram.py`).
    - Complex interactions like Kanban board drag-and-drop.

---

## Running Tests

Tests can be executed globally from the root using Turbo or individually within each workspace.

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
| **CI Pipeline** | GitHub Actions Pipeline | Green/Pass |

---

## Troubleshooting & Best Practices

### Database State Management
Integration tests often fail due to unique constraint violations (e.g., `email` in `UserTable`). 
- **Solution**: Use the standardized database initialization helpers in `apps/api/src/test-utils`. Always include a `truncate` call in `beforeEach` hooks to ensure a clean slate.

### Mocking External Dependencies
- **Browser APIs**: When testing UI components that use `ResizeObserver` or `IntersectionObserver`, provide mocks in `vitest.setup.ts`.
- **AI Providers**: Mock LLM responses in `apps/hermes-agency` to avoid non-deterministic results and API costs. Use `vi.mock` for the `litellm` router or internal skill triggers.

### Testing tRPC Procedures
Use the specialized `trpcQuery` or `trpcMutation` helpers in the API test suite. These helpers simulate the `FastifyRequest` context, allowing you to test authorized procedures without spinning up a full HTTP server.

### State Machine & Async Logic
For flows involving `langgraph` or distributed locks (`distributed_lock.ts`):
- Use `vi.useFakeTimers()` to handle timeouts.
- Ensure `releaseLock` is called in `finally` blocks within tests to prevent deadlocks in the test runner.

---

**Related Documentation:**
- [Development Workflow](./development-workflow.md)
- [API Architecture](../apps/api/README.md)
