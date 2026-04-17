# Testing Strategy

This document outlines the multi-layered testing strategy used to maintain quality and reliability across the monorepo. Our approach combines static analysis, isolated unit tests, and integrated functional tests to ensure that every change—from a Zod schema modification to a UI component update—is validated before reaching production.

## Overview

Quality is enforced through automated pipelines that run on every Pull Request. This ensures that regressions are caught early and that the contract between the frontend and backend (via tRPC and Zod schemas) remains intact.

### Core Testing Principles
- **Type Safety**: Leverage TypeScript and Zod for compile-time and runtime validation.
- **Isolation**: Unit tests should not depend on external services.
- **Reproduceability**: Integration tests must use clean database states.
- **Automation**: No code is merged without passing the CI suite.

---

## Test Types

### 1. Unit Tests
Focus on pure functions, utility methods, and isolated logic.
- **Tools**: Vitest, `@testing-library/react`, `@testing-library/jest-dom`.
- **Naming**: `*.test.ts` or `*.test.tsx`.
- **Scope**: 
    - Validation logic in `packages/zod-schemas/src/__tests__`.
    - Utility functions in `apps/web/src/utils` or `apps/api/src/utils`.
    - Component rendering and user events in `packages/ui`.
- **Example**: Testing a `UserCreateInput` schema against various edge cases.

### 2. Integration Tests
Validate that multiple units (routers, services, and databases) work together.
- **Tools**: Vitest, tRPC Callers, Testcontainers (Postgres/Redis).
- **Naming**: `*.integration.test.ts`.
- **Scope**:
    - tRPC procedures in `apps/api/src/routers`.
    - Middleware execution like `apiKeyAuthHook` or `sessionSecurity`.
    - Database interactions with tables such as `UsersTable`, `ContractsTable`, or `SubscriptionsTable`.
- **Example**: Creating a session via `authRouter` and verifying the record exists in `SessionTable`.

### 3. End-to-End (E2E) Tests
Validate critical user journeys from the perspective of a real user.
- **Tools**: Playwright.
- **Location**: Typically found in `apps/web/e2e` or specialized agent directories.
- **Scope**:
    - Google OAuth2 login flows.
    - Complex Kanban board drag-and-drop interactions.
    - Real-time event processing in the `Hermes Agency` orchestrator.

---

## Running Tests

Tests can be executed globally from the root using Turbo or individually within each workspace.

### Global Execution
Run all tests across all packages:
```bash
yarn test
```

### Workspace Specific
Run tests for a specific application or package:
```bash
# Web Application
yarn workspace @connected-repo/web test

# API (Watch Mode)
yarn workspace @connected-repo/api test --watch

# Shared Schemas
yarn workspace @connected-repo/zod-schemas test
```

### Coverage Reports
Generate a code coverage summary to identify untested paths:
```bash
yarn workspace @connected-repo/api test --coverage
```

### Targeted Testing
Run a specific file to speed up development:
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
| **Static Analysis** | `yarn lint` and `yarn format:check` | 0 Errors |
| **Type Safety**| `yarn typecheck` | Success |
| **CI Pipeline** | GitHub Actions (Postgres/Redis) | Green/Pass |

---

## Troubleshooting & Best Practices

### Database State Management
If integration tests fail due to unique constraint violations (e.g., duplicated email in `UserTable`):
- Ensure your test suite uses the `truncate` utility in the `beforeEach` or `afterEach` hook.
- Check `apps/api/src/test-utils` for standardized DB initialization helpers.

### Mocking Browser APIs
When testing components in `packages/ui`, JSDOM may lack support for newer APIs like `IntersectionObserver` or `ResizeObserver`.
- **Solution**: Use `vi.stubGlobal` or provide mocks in your `vitest.setup.ts` file.

### Dealing with Flaky AI/Async Tests
Tests involving LLM responses in `apps/hermes-agency` or long-running workfows can be non-deterministic.
- **Solution**: Use `vi.useFakeTimers()` for state machines and mock LLM providers like `litellm` in unit test scenarios.
- **Optimization**: Use the `--shard` flag in CI to split heavy suites across multiple runners.

---

**Related Documentation:**
- [Development Workflow](./development-workflow.md)
- [API Architecture](../apps/api/README.md)
