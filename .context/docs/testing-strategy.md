# Testing Strategy

The quality of the monorepo is maintained through a multi-layered testing strategy that combines static analysis, isolated unit tests, and integrated functional tests. Our goal is to ensure that every change—from a Zod schema modification in `packages/zod-schemas` to a UI component update in `packages/ui`—is validated before reaching production.

Quality is enforced through automated pipelines that run on every pull request, ensuring that regressions are caught early and that the contract between the frontend and backend (via tRPC) remains intact.

## Test Types

### Unit Tests
*   **Tools**: Vitest 4, `@testing-library/react`, `@testing-library/jest-dom`.
*   **Naming Convention**: `*.test.ts` or `*.test.tsx`.
*   **Scope**: Focuses on pure functions, utility methods in `apps/web/src/utils`, and Zod validation logic in `packages/zod-schemas`. React components are tested in isolation using JSDOM.
*   **Key Files**: `packages/zod-schemas/src/__tests__`, `apps/api/src/modules/auth/__tests__`.

### Integration Tests
*   **Tools**: Vitest, tRPC Callers.
*   **Naming Convention**: `*.integration.test.ts`.
*   **Scenario**: Validating tRPC procedures against a live test database. This ensures that the `apps/api` routers, middlewares (like `apiKeyAuthHook`), and database tables (e.g., `UsersTable`, `ContractsTable`) work together correctly.

### End-to-End (E2E)
*   **Tools**: Playwright.
*   **Naming Convention**: Located in `apps/perplexity-agent/e2e` or similar `e2e/` directories.
*   **Scenario**: Validating critical user journeys such as Google OAuth2 login flows, complex form submissions in the Kanban module, and real-time event processing in the Hermes Agency orchestrator.

---

## Running Tests

Tests can be executed globally from the root using Turbo or individually within each workspace.

### Run All Tests
To execute all tests across the monorepo:
```bash
yarn test
```

### Workspace Specific
To run tests for a specific package or application:
```bash
# Example: Testing the Web application
yarn workspace @connected-repo/web test

# Example: Testing the API with Watch Mode
yarn workspace @connected-repo/api test --watch
```

### Coverage Reports
To generate a code coverage summary:
```bash
yarn workspace @connected-repo/web test --coverage
```

### Targeted Testing
Run a specific test file during development to save time:
```bash
npx vitest apps/api/src/modules/auth/__tests__/session.test.ts
```

---

## Quality Gates

To maintain high code standards, the following quality gates must be passed before merging any Pull Request:

1.  **Coverage Requirements**:
    *   Minimum **80%** line coverage for core business logic in `apps/api/src/modules`.
    *   **100%** coverage for shared schemas in `packages/zod-schemas`.
2.  **Static Analysis**:
    *   `yarn lint`: Must pass with zero errors.
    *   `yarn format:check`: Confirms code adheres to Prettier configurations.
3.  **Type Safety**:
    *   `yarn typecheck`: Must pass across the entire monorepo to ensure tRPC interfaces and Zod-inferred types are consistent.
4.  **CI/CD Pipeline**:
    *   All tests must pass in GitHub Actions, which utilizes service containers for Postgres 15 and Redis to support integration suites.

---

## Troubleshooting

### Flaky Database Tests
Integration tests for the API require a clean state. If tests fail due to unique constraint violations (e.g., `UserTable` or `TeamTable` entries):
*   Verify the test suite uses the `truncate` utility in the `beforeEach` hook.
*   Ensure the `test-utils` in `apps/api/src/test-utils` are correctly initializing the DB connection.

### JSDOM Environment Issues
When testing components in `packages/ui`, you may encounter errors related to missing browser APIs (like `IntersectionObserver`).
*   **Solution**: Mock these APIs in `apps/web/src/test-setup.ts` or the relevant `vitest.setup.ts`.

### Long-Running Suites
The Hermes Agency's `WorkflowStateMachine` and `EventBus` tests can be resource-intensive.
*   **Optimization**: Use the `--shard` flag in Vitest to split the load across multiple runners in CI environments.

---

**See Also:**
*   [Development Workflow](./development-workflow.md): Instructions on local environment setup.
*   [API Documentation](../apps/api/README.md): Details on backend router structures.
