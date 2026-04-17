# Project Overview

The **connected-repo** is a high-performance, TypeScript-first monorepo designed to accelerate the development of feature-rich web applications. It serves as a "feature factory," enabling developers to transform entity definitions into complete software modules—spanning database schemas, API endpoints, and user interfaces—using automated scaffolding and unified type safety.

## 🏗 Architecture & Core Layers

The repository is organized into a clean monorepo structure using **Yarn Workspaces** and **Turborepo**, separating concerns into distinct applications and shared packages.

### 1. Applications (`apps/`)
- **`apps/api`**: The core backend service. Built with **Fastify 5**, it hosts the **tRPC** router, REST endpoints, and background workers. It uses **Orchid ORM** for type-safe database interactions.
- **`apps/web`**: The main frontend application. A **React 19** SPA powered by **Vite**, **TanStack Query**, and **Material-UI (MUI)**. It consumes the API via a type-safe tRPC client.
- **`apps/ai-gateway`**: A specialized service providing an OpenAI-compatible interface, handling audio (STT/TTS), chat completions, and vision processing.
- **`apps/hermes-agency`**: A Python-based agentic framework utilizing **LangGraph** and **LiteLLM** for complex AI workflows, social media automation, and Telegram bot interactions.

### 2. Shared Packages (`packages/`)
- **`packages/zod-schemas`**: The single source of truth for data validation. These schemas define the shape of data from the database layer up to the frontend forms.
- **`packages/ui`**: A shared component library integrating **MUI** with **React Hook Form (RHF)**, providing standardized inputs, buttons, and layout elements.
- **`packages/db`**: Centralized database configuration, migration management, and the Orchid ORM instance.

---

## 🛠 Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Language** | TypeScript (Primary), Python (AI/Agents) |
| **Frontend Framework** | React 19 (SPA) |
| **Backend Framework** | Fastify 5 |
| **API Protocol** | tRPC (Internal), REST (External/Webhooks) |
| **Database** | PostgreSQL 15 |
| **ORM** | Orchid ORM (Type-safe query builder) |
| **Validation** | Zod |
| **Styling/UI** | Material-UI (MUI) v6 |
| **State Management** | TanStack Query (Server State) |
| **Build/Monorepo** | Vite, Turbo 2, Yarn Workspaces |

---

## 🚀 Key Entry Points

- **Backend API**: `apps/api/src/index.ts` (Running on Port 4000)
- **Frontend Web**: `apps/web/src/main.tsx` (Running on Port 5173)
- **AI Router**: `apps/hermes-agency/src/router/agency_router.ts`
- **Workflow Engine**: `apps/orchestrator/src/core/workflow-engine.ts`

---

## 🤖 AI-Augmented Development

This codebase is optimized for "Agentic Workflows." It includes custom automation tools located in `.claude/` that allow developers to use slash commands for rapid development:

- **`/scaffold`**: Generates a full vertical slice of a feature. It creates the database table, Zod schemas, tRPC router, and the React CRUD pages (List, Create, Edit).
- **`/feature`**: Automates the Git workflow for new features, including branch creation.
- **`/ship`**: Handles the transition from local development to a Pull Request, including semantic commit generation.

---

## 📂 Logical Module Structure

Functionality is grouped into modules that exist across the stack (API + Web). Key modules include:

- **CRM & Clients**: `Address`, `Client`, `Contact`, `Unit`.
- **Operations**: `ServiceOrder`, `TechnicalReport`, `Schedule`, `Maintenance`.
- **Project Management**: `KanbanBoard`, `KanbanColumn`, `KanbanCard`.
- **Communication**: `EmailCampaign`, `EmailTemplate`, `Webhooks`.
- **AI & Content**: `Prompt`, `ContentEngine`, `McpConnector`.

---

## 🏁 Getting Started

### 1. Environment Setup
Copy the example environment file and configure your local settings (DB credentials, API keys):
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
yarn install
```

### 3. Database Initialization
Ensure Docker is running, then start the database and run migrations:
```bash
docker compose up -d
yarn db -- up
```

### 4. Run Development Servers
Start all applications in development mode simultaneously:
```bash
yarn dev
```

The web dashboard will be available at `http://localhost:5173`.

---

## 📖 Further Reading
- **[Architecture Guide](./architecture.md)**: Deep dive into the system design and data flow.
- **[Development Workflow](./development-workflow.md)**: Details on using the scaffolding tools and coding standards.
- **[Tooling](./tooling.md)**: Information on the monorepo management and CI/CD.
