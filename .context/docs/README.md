# Monorepo Documentation Hub

Welcome to the central documentation for the enterprise management and AI orchestration ecosystem. This monorepo implements a high-performance stack for business operations, research automation, and AI-driven workflows.

## 🏗 System Architecture

The project is structured as a **pnpm monorepo**, utilizing a modular architecture that separates deployable applications from shared business logic and UI components.

### Core Applications
- **`apps/api`**: A Fastify-powered backend serving as the central data hub. It uses **tRPC** for type-safe internal communication, handles Session-based & Google OAuth2 authentication, and manages a robust API Gateway for external integrations.
- **`apps/web`**: A React + Vite dashboard. It features a modular structure covering CRM (Leads, Clients), ERP (Service Orders, Maintenance), and Operations (Kanban, Calendars).
- **`apps/ai-gateway`**: A specialized proxy for AI services, handling OpenAI-compatible requests, audio transcriptions (Whisper), and Portuguese language filtering/preprocessing.
- **`apps/hermes-agency`**: An AI orchestration layer built with **LangGraph** and **LiteLLM**. It manages complex multi-agent workflows including social media scheduling and Telegram bot interactions.

### Shared Packages
- **`packages/zod-schemas`**: The **Single Source of Truth** for data validation. These schemas drive runtime validation in the API and type inference in the Frontend.
- **`packages/ui`**: A design system built on **Material UI (MUI)**. It includes a specialized React Hook Form integration (`rhf-form`) for consistent data entry.
- **`packages/trpc`**: Shared type definitions ensuring the Web frontend and API backend remain perfectly synchronized.

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| **Runtime** | Node.js (v20+) |
| **Language** | TypeScript |
| **API Framework** | Fastify, tRPC v11 |
| **Frontend** | React 18, Vite, TanStack Query, MUI |
| **Database** | PostgreSQL, Drizzle ORM |
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
├── scripts/                # Python-based AI microservices (Whisper v2)
└── docs/                   # Detailed Technical Guides
```

---

## 🚀 Key Modules & Services

### 1. API Gateway & Webhooks (`apps/api`)
Managed through `apps/api/src/modules/api-gateway`, this layer handles:
- **API Key Authentication**: Secure header-based auth for external services via `apiKeyAuthHook`.
- **Usage Tracking**: Monitor API consumption (e.g., `subscriptionTracker`) and trigger alerts at 90% usage.
- **Webhook Delivery**: Reliable event broadcasting with delivery logging in `WebhookDeliveriesTable`.

### 2. AI Agency & Orchestration (`apps/hermes-agency`)
A high-level agentic layer:
- **Language Workflows**: Multi-step pipelines for social media and content approval in `src/langgraph/`.
- **Telegram Integration**: A feature-rich bot (`bot.ts`) supporting STT (Whisper), Vision (Ollama/Qwen), and TTS (Kokoro).
- **Distributed Locking**: Redis-backed concurrency control (`distributed_lock.ts`) to manage shared agent states.

### 3. Unified Form System (`packages/ui/src/rhf-form`)
A tight integration between Zod and React Hook Form:
- **`useRhfForm`**: A custom hook that streamlines form state, validation, and submission logic.
- **Components**: `RhfTextField`, `RhfSelect`, `RhfCheckbox`, and `RhfSwitch` provide automatic error handling and styling consistent with the material theme.

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
  - Generate: `pnpm --filter @repo/db db:generate`
  - Migrate: `pnpm --filter @repo/db db:migrate`
- **Lint & Build**: `pnpm build`

### Adding a New Business Module
1. **Schema**: Create `packages/zod-schemas/src/[module].zod.ts`.
2. **Persistence**: Define the Drizzle table in `apps/api/src/modules/[module]/tables/`.
3. **Logics**: Register new routes in `apps/api/src/routers/trpc.router.ts`.
4. **UI**: Create pages in `apps/web/src/modules/[module]/` using the shared UI components.

---

## 📚 Related Documentation
- [Architecture Details](./architecture.md)
- [API Gateway Reference](./api-gateway.md)
- [MCP & AI Integration](./mcp-guide.md)
- [Testing Strategy](./testing-strategy.md)
