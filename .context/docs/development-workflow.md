# Development Workflow

The engineering process in this repository is designed for high velocity with a strong emphasis on automation and type safety. We follow a standardized daily routine that leverages our internal CLI tools to minimize context switching and boilerplate. Engineers are expected to work in a "test-first" or "types-first" manner, defining Zod schemas in `packages/zod-schemas` before implementing business logic in the API or UI. All changes must originate from a dedicated feature branch and pass the automated CI pipeline before merging into the trunk.

## Branching & Releases

Our repository follows a **Trunk-Based Development** model with short-lived feature branches:

- **Main Branch (`main`)**: The source of truth. It represents the production-ready state of the codebase. All code in `main` must pass all CI checks and builds.
- **Feature Branches (`feature/*`)**: Used for all new development. Use the `/feature` command to generate a standardized branch name.
- **Fix Branches (`fix/*`)**: Specifically for bug fixes identified in production or during QA.
- **Chore Branches (`chore/*`)**: For dependency updates, configuration changes, or non-functional maintenance.
- **Release Tagging**: We use Semantic Versioning (SemVer). Production releases are triggered by merging to `main`, which automatically generates a version tag (e.g., `v1.2.3`) based on the conventional commits in the cycle.

## Local Development

Follow these steps to get your environment ready and run the services safely. Note the port governance requirements to avoid conflicts with infrastructure like CapRover.

- **Pre-requisite**: Ensure Docker is running.
- **Install Dependencies**: `yarn install`
- **Infrastructure**: `docker compose up -d` (Starts PostgreSQL 15 and Redis)
- **Database Migrations**: `yarn db -- up` (Synchronizes Orchid ORM schemas)
- **Run Application**: `yarn dev` (Starts Backend on `:4000` and Frontend on `:5173`)
- **Build Services**: `yarn build` (Validates the entire monorepo build)
- **Type Check**: `yarn check-types`

**Port Safety Check:**
- Backend API: `http://localhost:4000`
- Web Frontend: `http://localhost:5173`
- **NEVER** use port `3000` on the local host as it is reserved for CapRover infrastructure.

## Code Review Expectations

All Pull Requests (PRs) require at least one approval from a maintainer before they can be merged. The review focuses on:

1.  **Type Integrity**: Ensuring Zod schemas correctly reflect the database and API contracts.
2.  **Performance**: Checking for "N+1" queries in the API (`apps/api`) and unnecessary re-renders in the frontend (`apps/web`).
3.  **Consistency**: Following the [Tooling Guide](./tooling.md) for slash commands and using established components from `packages/ui`.
4.  **Testing**: Verify the PR includes relevant Vitest or E2E tests as defined in the [Testing Strategy](./testing-strategy.md).

**Agent Collaboration**: When working with AI agents (e.g., Cursor, Claude), please refer to [AGENTS.md](../../AGENTS.md) for prompt instructions and workflow tips to ensure agent-generated code adheres to our monorepo patterns.

## Onboarding Tasks

If you are new to the repository, please start with these tasks to familiarize yourself with the stack:

1.  **Environment Setup**: Run the local development commands and ensure you can log in to the dashboard using the credentials found in `seedDevTeam`.
2.  **Explore the Schema**: Look at `packages/zod-schemas/src/user.zod.ts` to understand how our data models are defined.
3.  **First Issue**: Look for tickets tagged with `good-first-issue` in our project management system. These usually involve adding a simple field to a CRUD module or fixing a UI glitch in `packages/ui`.
4.  **Run a Scaffold**: Try creating a test module using `/scaffold` to see how the API, DB, and UI layers are automatically connected.

---

### Related Resources
- [Testing Strategy](./testing-strategy.md) - Learn about our unit and E2E testing patterns.
- [Tooling Guide](./tooling.md) - Reference for `/feature`, `/ship`, and `/scaffold` commands.
- [Agent Guidelines](../../AGENTS.md) - Best practices for AI-assisted engineering.
