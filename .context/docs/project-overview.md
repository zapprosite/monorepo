# Project Overview

The **connected-repo** is a high-performance, TypeScript-first monorepo designed to accelerate the development of feature-rich web applications. It serves as a "feature factory," enabling developers to transform entity definitions into complete software modules—spanning database schemas, API endpoints, and user interfaces—using automated scaffolding and unified type safety.

---

## 🏗 Architecture & Core Layers

The repository is organized using **Yarn Workspaces** and **Turborepo**, separating concerns into distinct applications and shared packages.

### 1. Applications (`apps/`)

*   **`apps/api`**: The core backend service. Built with **Fastify 5**, it hosts the **tRPC** router, REST endpoints, and background workers. It uses **Orchid ORM** for type-safe database interactions and session management.
*   **`apps/web`**: The main frontend application. A **React 19** SPA powered by **Vite**, **TanStack Query**, and **Material-UI (MUI)**. It consumes the API via a type-safe tRPC client.
*   **`apps/ai-gateway`**: A specialized service providing an OpenAI-compatible interface, handling audio (STT/TTS), chat completions, and vision processing. It supports LLM providers like Groq and Ollama.
*   **`apps/hermes-agency`**: A multi-agent framework utilizing **LangGraph**, **LiteLLM**, and **Qdrant** for complex AI workflows, social media automation, and Telegram bot interactions.

### 2. Shared Packages (`packages/`)

*   **`packages/zod-schemas`**: The single source of truth for data validation. These schemas define the shape of data from the database layer (`apps/api`) up to the frontend forms (`apps/web`).
*   **`packages/ui`**: A shared component library integrating **MUI v6** with **React Hook Form (RHF)**, providing standardized hooks (`useRhfForm`) and components (TextFields, Selects, Buttons).
*   **`packages/db`**: Centralized database configuration, migration management, and the Orchid ORM instance shared by backend services.

---

## 🛠 Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Language** | TypeScript (Primary), Python (AI/HVAC RAG) |
| **Frontend Framework** | React 19 (SPA) |
| **Backend Framework** | Fastify 5 |
| **API Protocol** | tRPC v11 (Internal), REST (External/Webhooks/AI) |
| **Database** | PostgreSQL 15 |
| **ORM** | Orchid ORM (Type-safe query builder) |
| **Validation** | Zod |
| **Styling/UI** | Material-UI (MUI) v6 |
| **State Management** | TanStack Query (Server State) |
| **AI Orchestration** | LangGraph, LiteLLM, Qdrant (Vector DB) |
| **Build/Monorepo** | Vite, Turbo 2, Yarn Workspaces |

---

## 🚀 Key Entry Points

*   **Backend API**: `apps/api/src/index.ts` (Port 4000)
    *   Exposes tRPC at `/trpc` and various REST webhooks.
*   **Frontend Web**: `apps/web/src/main.tsx` (Port 5173)
*   **AI Gateway**: `apps/ai-gateway/src/index.ts` (Port 3001)
    *   Routes: `/v1/chat/completions`, `/v1/audio/transcriptions`, `/v1/audio/speech`.
*   **HVAC RAG Pipeline**: `scripts/hvac-rag/hvac_rag_pipe.py`
    *   Specialized Python-based retrieval/augmentation system for technical HVAC domain data.

---

## 🤖 AI-Augmented Development

This codebase is optimized for **Agentic Workflows**. It includes custom automation tools and logic designed for rapid development:

*   **Vertical Scaffolding**: Features are designed to be generated as "vertical slices." Defining a database table automatically informs the Zod validation schemas, which in turn drive the tRPC router and the UI components.
*   **Agent Integration**: The `apps/hermes-agency` acts as an orchestrator, allowing the system to use "skills" (like `make-pdf` or `memory-search`) to perform complex tasks.
*   **HVAC Intelligence**: A robust RAG (Retrieval-Augmented Generation) pipeline in `scripts/hvac-rag` handles technical documentation, error code resolution, and field tutor capabilities for specialized technicians.

---

## 📂 Logical Module Structure

Functionality is grouped into modules that exist across the stack. Most follow a consistent CRUD pattern:

| Category | Modules |
| :--- | :--- |
| **CRM & Clients** | `Address`, `Client`, `Contact`, `Unit` |
| **Operations** | `ServiceOrder`, `TechnicalReport`, `Schedule`, `Maintenance` |
| **Project/Task** | `Board`, `KanbanColumn`, `KanbanCard` |
| **Communications** | `EmailCampaign`, `EmailTemplate`, `Webhooks` |
| **Governance** | `User`, `Team`, `UserRole`, `Prompt`, `AuditLog` |

---

## 🏁 Getting Started

### 1. Environment Setup
Copy the example environment file and configure your local settings:
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
yarn install
```

### 3. Database Initialization
Ensure Docker is running for PostgreSQL, then run migrations and seeds:
```bash
# Start infrastructure
docker compose up -d

# Run migrations and seed data
yarn db migration up
yarn db seed
```

### 4. Run Development Servers
Start all applications in development mode simultaneously:
```bash
yarn dev
```
The web dashboard will be available at `http://localhost:5173`.

---

## 📖 Further Reading

*   **Architecture Guide**: Deep dive into the tRPC setup and Orchid ORM integration.
*   **AI Gateway Documentation**: Details on configuring Groq, OpenAI, or Ollama providers.
*   **HVAC RAG Guide**: Documentation for the Python-based technical support pipeline.
