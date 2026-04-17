# Monorepo Documentation Hub

Welcome to the comprehensive guide for this monorepo. This repository contains a high-performance ecosystem for business management, AI orchestration, and automated research, built with a modern TypeScript stack.

## 🏗 System Architecture

The project is structured as a **pnpm monorepo**, utilizing a modular architecture that separates deployable applications from shared business logic and UI components.

### Core Applications
- **`apps/api`**: A Fastify-powered backend that serves as the central hub for data. It implements tRPC for type-safe internal communication, handles Session & Google OAuth2 authentication, and provides an API Gateway for external service integrations.
- **`apps/web`**: A React + Vite frontend dashboard. It features a modular structure covering CRM (Leads, Clients), ERP (Service Orders, Equipment), and Operations (Kanban, Calendars, Journal Entries).
- **`apps/ai-gateway`**: A specialized proxy for AI services, handling OpenAI-compatible requests, audio transcriptions (Whisper), and Portuguese language filtering/preprocessing.
- **`apps/hermes-agency`**: An AI orchestration layer using LangGraph and LiteLLM. It manages complex workflows like social media scheduling, content pipelines, and Telegram bot interactions.

### Shared Packages
- **`packages/zod-schemas`**: The **Single Source of Truth** for data validation. These schemas are used by the API for runtime validation and by the Web app for TypeScript type inference.
- **`packages/ui`**: A design system built on Material UI (MUI). It includes low-level atoms (buttons, spinners) and a specialized React Hook Form integration (`rhf-form`) for consistent data entry.
- **`packages/trpc`**: Shared type definitions that ensure the Web frontend and API backend stay in sync without manual glue code.

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
| **Orchestration** | LangGraph, LiteLLM, Redis (for locking/rate-limiting) |

---

## 📁 Repository Map

```text
├── apps/
│   ├── api/                # Core Backend & API Gateway
│   ├── web/                # Main Dashboard UI
│   ├── ai-gateway/         # AI Proxy (STT/TTS/Chat)
│   ├── hermes-agency/      # AI Agents & Automation Logic
│   └── perplexity-agent/   # Research Automation Agent
├── packages/
│   ├── zod-schemas/        # Global validation (Source of Truth)
│   ├── ui/                 # Design System & Form Components
│   ├── trpc/               # Type-safe API contracts
│   └── config-eslint/      # Standardized linting rules
├── scripts/                # Python-based AI microservices (Whisper, etc.)
└── docs/                   # Full technical documentation
```

---

## 🚀 Key Modules & Services

### 🛡 API Gateway & Security (`apps/api/src/modules/api-gateway`)
A robust layer managing external access:
- **API Key Auth**: Middleware providing secure access for third-party integrations.
- **Subscription Tracking**: Logic to monitor API usage and trigger 90% threshold webhooks.
- **Webhook Engine**: A delivery system with retry logic and event logging located in `modules/webhooks`.

### 🧠 AI Agency (`apps/hermes-agency`)
A high-level orchestration layer:
- **Content Pipeline**: Automated content creation and approval workflows found in `src/langgraph/content_pipeline.ts`.
- **Skills System**: Encapsulated capabilities (e.g., Google Search, Image Analysis) used by agents.
- **Distributed Locking**: Redis-backed concurrency control for Telegram bot interactions.

### 📝 Form Management (`packages/ui/src/rhf-form`)
Standardized React forms using Zod and React Hook Form:
- **`useRhfForm`**: Custom hook for handling submission and validation states.
- **Input Components**: `RhfTextField`, `RhfSelect`, and `RhfSwitch` that integrate directly with the form context.

---

## 📖 Development Workflow

### 1. Initialization
```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Initialize database
pnpm --filter @repo/db db:push
```

### 2. Routine Commands
- **Start Dev Mode**: `pnpm dev` (Runs API, Web, and AI services concurrently)
- **Database Migrations**: `pnpm --filter @repo/db db:generate` followed by `db:migrate`
- **Build All**: `pnpm build`

### 3. Creating a New Feature
1.  **Define Schema**: Add a new `.zod.ts` file in `packages/zod-schemas`.
2.  **Define Table**: Implement the Drizzle table in `apps/api/src/modules/[module]/tables/`.
3.  **Implement Router**: Create a tRPC router in `apps/api/src/routers/`.
4.  **Build UI**: Use the `packages/ui` components in `apps/web` to consume the new endpoint.

---

## 📚 Related Documentation
- [Architecture Details](./architecture.md)
- [API Gateway Reference](./api-gateway.md)
- [MCP & AI Integration](./mcp-guide.md)
- [Testing Strategy](./testing-strategy.md)
