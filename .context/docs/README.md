# Monorepo Documentation Hub

Welcome to the central documentation for the enterprise management and AI orchestration ecosystem. This monorepo implements a high-performance stack for business operations, research automation, and AI-driven workflows using a modular, type-safe architecture.

## 🏗 System Architecture

The project is structured as a **pnpm monorepo**, separating deployable applications from shared business logic and UI components to ensure scalability and maintainability.

### Core Applications
- **`apps/api`**: A Fastify-powered backend serving as the central data hub. It uses **tRPC** for type-safe communication, manages Session-based & Google OAuth2 authentication, and includes a robust API Gateway for external integrations.
- **`apps/web`**: A React + Vite dashboard featuring a modular structure for CRM (Leads, Clients), ERP (Service Orders, Maintenance), and Operations (Kanban, Calendars).
- **`apps/ai-gateway`**: A specialized proxy for AI services, handling OpenAI-compatible requests, audio transcriptions (Whisper), and Portuguese language filtering/preprocessing.
- **`apps/hermes-agency`**: An AI orchestration layer built with **LangGraph** and **LiteLLM**. It manages multi-agent workflows including social media scheduling and Telegram bot interactions.

### Shared Packages
- **`packages/zod-schemas`**: The **Single Source of Truth** for data validation. These schemas drive runtime validation in the API and type inference in the Frontend.
- **`packages/ui`**: A design system built on **Material UI (MUI)**. It includes a specialized React Hook Form integration (`rhf-form`) for consistent data entry.
- **`packages/trpc`**: Shared type definitions ensuring the Web frontend and API backend remain perfectly synchronized via end-to-end type safety.

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| **Runtime** | Node.js (v20+) |
| **Language** | TypeScript, Python (AI Scripts) |
| **API Framework** | Fastify, tRPC v11 |
| **Frontend** | React 18, Vite, TanStack Query, MUI |
| **Database** | PostgreSQL, Drizzle ORM, Qdrant (Vector DB) |
| **Validation** | Zod |
| **Orchestration** | LangGraph, LiteLLM, Redis (Locking/Rate-limiting) |

---

## 📁 Repository Map

```text
├── apps/
│   ├── api/                # Backend API & Gateway (Fastify + Drizzle)
│   ├── web/                # React Dashboard (MUI + TanStack Query)
│   ├── ai-gateway/         # AI Proxy & Audio Processing
│   ├── hermes-agency/      # AI Agents & Automation Logic
│   └── perplexity-agent/   # Research Automation Agent
├── packages/
│   ├── zod-schemas/        # Validation & Type Definitions (Core)
│   ├── ui/                 # Design System & Form Components
│   └── trpc/               # Type-safe API contracts
├── scripts/                # Python-based AI microservices (HVAC RAG & Whisper)
└── docs/                   # Detailed Technical Guides
```

---

## 🚀 Key Modules & Services

### 1. API Gateway & Webhooks (`apps/api`)
Managed within `apps/api/src/modules/`, this layer handles:
- **API Security**: Implements `SessionSecurityLevel` and IP/Domain whitelisting via `isIPWhitelisted`.
- **Type-Safe Routing**: Uses a `createCrudRouter` factory to standardize REST/tRPC endpoints for entities like `Clients`, `Leads`, and `ServiceOrders`.
- **Document Generation**: Skills like `makePdf` and templates for Technical Reports and Service Orders (`os-pdf.html.ts`).

### 2. AI Agency & HVAC RAG
The platform features specialized AI capabilities:
- **RAG Pipeline**: Extensive Python scripts in `scripts/hvac-rag` for processing HVAC documentation, including `hvac_rag_pipe.py` and `hvac_resolver.py`.
- **AI Gateway**: Provides a unified interface for LLMs with features like `applyPtbrFilter` to ensure response quality in Portuguese and `audioTranscriptionsRoute` for Whisper integration.

### 3. Unified Form System (`packages/ui/src/rhf-form`)
A tight integration between Zod and React Hook Form (RHF):
- **`useRhfForm`**: A custom hook in `packages/ui` that streamlines form state, validation, and submission.
- **Controlled Components**: `RhfTextField`, `RhfSelect`, `RhfCheckbox`, and `RhfSwitch` provide automatic error handling and MUI-consistent styling.

---

## 📖 Development Workflow

### Initialization
```bash
# Install dependencies across the monorepo
pnpm install

# Setup local environment
cp .env.example .env

# Push database schema to your local PostgreSQL
pnpm --filter @repo/db db:push
```

### Routine Commands
- **Launch Development**: `pnpm dev` (Starts API, Web, and AI services concurrently)
- **Database Changes**: 
  - Generate migrations: `pnpm --filter @repo/db db:generate`
  - Apply migrations: `pnpm --filter @repo/db db:migrate`
- **Build All**: `pnpm build`

### Adding a New Business Module
1. **Define Schema**: Create a new Zod file in `packages/zod-schemas/src/[module].zod.ts`.
2. **Database Table**: Define the Drizzle table in `apps/api/src/modules/[module]/[module].table.ts`.
3. **Register Route**: Add the module to the `AppTrpcRouter` in `apps/api/src/routers/trpc.router.ts`.
4. **Build UI**: Create pages in `apps/web/src/modules/[module]/` utilizing the shared `packages/ui` components and the generated tRPC hooks.

---

## 📚 Related Documentation
- **[Architecture Details](./architecture.md)**: Deep dive into patterns and data flow.
- **[API Gateway Reference](./api-gateway.md)**: Documentation for the external-facing API.
- **[MCP & AI Integration](./mcp-guide.md)**: How to connect Model Context Protocol tools.
- **[Testing Strategy](./testing-strategy.md)**: Guidelines for unit, integration, and smoke tests.
