# Testing Strategy

The quality of the monorepo is maintained through a multi-layered testing strategy that combines static analysis, isolated unit tests, and integrated functional tests. Our goal is to ensure that every change—from a Zod schema modification in `packages/zod-schemas` to a UI component update in `packages/ui`—is validated before reaching production. 

Quality is enforced through automated pipelines that run on every pull request, ensuring that regressions are caught early and that the contract between the frontend and backend (via tRPC) remains intact.

## Test Types

- **Unit Tests**:
    - **Tools**: Vitest 4, `@testing-library/react`, `@testing-library/jest-dom`.
    - **Naming Convention**: `*.test.ts` or `*.test.tsx`.
    - **Scope**: Used for pure functions, utility methods in `apps/web/src/utils`, and Zod validation logic in `packages/zod-schemas`. React components are tested in isolation using JSDOM.
- **Integration Tests**:
    - **Tools**: Vitest, tRPC Callers.
    - **Naming Convention**: `*.integration.test.ts`.
    - **Scenario**: Testing tRPC procedures against a live test database. This ensures that the `apps/api` routers, middlewares (like `apiKeyAuthHook`), and database tables (e.g., `UsersTable`, `ContractsTable`) work together correctly.
- **E2E (End-to-End)**:
    - **Tools**: Playwright.
    - **Naming Convention**: Located in `apps/perplexity-agent/e2e` or similar `e2e/` directories.
    - **Scenario**: Validating critical user journeys such as OAuth2 login flows, complex form submissions in the Kanban module, and real-time event processing in the Orchestrator.

## Running Tests

Tests can be executed globally from the root using Turbo or individually within each workspace.

- **Run all tests**:
```bash
# From the monorepo root
yarn test
```

- **Run tests in Watch Mode**:
```bash
# Specific to a workspace (e.g., the API)
yarn workspace @connected-repo/api test --watch
```

- **Generate Coverage Report**:
```bash
# Runs tests and produces a coverage summary
yarn workspace @connected-repo/web test --coverage
```

- **Run specific test file**:
```bash
# Useful during development
npx vitest apps/api/src/modules/auth/__tests__/session.test.ts
```

## Quality Gates

To maintain high code standards, the following quality gates must be passed before merging any Pull Request:

- **Coverage Requirements**: 
    - Minimum **80%** line coverage for core business logic in `apps/api/src/modules`.
    - **100%** coverage for shared schemas in `packages/zod-schemas`.
- **Linting & Formatting**: 
    - `yarn lint` must pass with zero errors.
    - `yarn format:check` must confirm code adheres to Prettier configurations.
- **Type Safety**:
    - `yarn typecheck` must pass across the entire monorepo to ensure tRPC interfaces and Zod-inferred types are consistent.
- **CI/CD Pipeline**:
    - All tests must pass in the GitHub Actions environment, which spins up a Postgres 15 service container for integration suites.

## Troubleshooting

### Flaky Database Tests
Integration tests for the API require a clean state. If tests are failing due to unique constraint violations (e.g., `UserTable` or `TeamTable` entries), ensure that the test suite uses the `truncate` utility in the `beforeEach` hook.

### JSDOM Environment Issues
When testing components in `packages/ui`, you may encounter errors related to missing browser APIs (like `IntersectionObserver`). These should be mocked in `apps/web/src/test-setup.ts`.

### Long-Running Suites
The Orchestrator's `WorkflowStateMachine` and `EventBus` tests can be resource-intensive. If the CI environment is timing out, consider using the `--shard` flag in Vitest to split the load across multiple runners.

---

**See Also:**
- [development-workflow.md](./development-workflow.md) for instructions on local environment setup.
