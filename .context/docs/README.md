# Developer Documentation: Monorepo Overview

Welcome to the central documentation hub for the monorepo. This repository houses a complex ecosystem comprising a high-performance API, a modern web frontend, an AI-driven orchestration engine, and a suite of shared packages.

## 🏗 System Architecture

The project is structured as a pnpm monorepo, divided into `apps` (deployable services) and `packages` (shared logic and UI).

### Core Applications
- **`apps/api`**: Fastify-based backend. Handles tRPC requests, database migrations, authentication (Session & OAuth2), and the API Gateway for external integrations.
- **`apps/web`**: React-based frontend using Vite. Contains modules for CRM (Clients, Leads), ERP (Service Orders, Equipment), and Management (Kanban, Calendars).
- **`apps/orchestrator`**: The intelligence layer. Implements a Workflow Engine, Agent Pool, and Model Context Protocol (MCP) adapters to integrate LLMs with internal tools.
- **`apps/perplexity-agent`**: Specialized agent for research and automated data retrieval.

### Shared Packages
- **`packages/db`**: Database schema definitions and Drizzle ORM configuration.
- **`packages/zod-schemas`**: Centralized Zod validation logic used for both runtime validation and TypeScript type inference across the stack.
- **`packages/ui`**: A design system built on MUI, containing specialized components like `RhfTextField` for integrated form handling.
- **`packages/trpc`**: Type-safe API definitions shared between the API and Web apps.

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| **Language** | TypeScript |
| **Backend** | Fastify, tRPC |
| **Frontend** | React, Vite, TanStack Query, MUI |
| **Database** | PostgreSQL, Drizzle ORM |
| **Validation** | Zod |
| **AI/LLM** | MCP (Model Context Protocol), Claude/Anthropic Adapters |
| **Package Management** | pnpm |

---

## 🚀 Key Modules & Services

### 🧠 Orchestrator Engine
The Orchestrator manages complex multi-step workflows.
- **`OrchestratorEngine`**: Executes workflows defined by phases and steps.
- **`WorkflowStateMachine`**: Manages the state transitions and persistence of active runs.
- **Human Gates**: Provides `ApprovalGateService` for workflows requiring manual intervention before proceeding.

### 🔌 MCP Connectors
The system uses the **Model Context Protocol** to expose internal data to AI models:
- **Adapters**: Support for Claude, Anthropic, Make, and Zapier.
- **Tools**: Dynamic tool discovery through `McpAdapter`.

### 🛡 API Gateway & Security
Located within `apps/api`, this module manages:
- **API Key Management**: `verifyApiKey` and `hashApiKey` utilities for external developers.
- **Rate Limiting**: Team-based limits via `teamRateLimitHook`.
- **IP Whitelisting**: Subnet and domain validation for secure webhook delivery and API access.
- **Webhook Processor**: A robust queue system with exponential backoff for delivery retries.

---

## 📁 Repository Map

```text
├── apps/
│   ├── api/                # Fastify + Drizzle + tRPC Server
│   ├── web/                # React Vite + MUI Dashboard
│   ├── orchestrator/       # AI Workflow & Agent Logic
│   └── perplexity-agent/   # Research Automation Agent
├── packages/
│   ├── db/                 # Migrations and Drizzle Schemas
│   ├── zod-schemas/        # Source of truth for data shapes
│   ├── ui/                 # Component library & Theme
│   ├── trpc/               # Contract between API and Web
│   └── env/                # Type-safe Environment variables
├── docs/                   # Canonical Documentation
└── package.json            # Workspace-wide scripts
```

---

## 📖 Development Workflow

### Getting Started
1. **Install Dependencies**: `pnpm install`
2. **Setup Environment**: Copy `.env.example` to `.env` in the root and in individual apps.
3. **Database Setup**: `pnpm --filter @repo/db db:push`
4. **Run Development Mode**: `pnpm dev` (Starts API, Web, and Orchestrator simultaneously).

### Testing
- **Unit Tests**: Run `pnpm test` within the specific package or app.
- **e2e Tests**: Found in `apps/perplexity-agent/e2e`.

### Schema Changes
All data shapes must be defined in `packages/zod-schemas`. After changing a schema:
1. Update the `.zod.ts` file in `packages/zod-schemas`.
2. Update the corresponding Drizzle table in `apps/api/src/modules/**/tables/`.
3. Run `pnpm db:generate` to create migrations.

---

## 📚 Related Documentation
- [Architecture Details](./architecture.md)
- [Testing Strategy](./testing-strategy.md)
- [API Gateway Reference](./api-gateway.md)
- [MCP & AI Integration](./mcp-guide.md)
