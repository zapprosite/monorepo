# Service Map

**Canonical source:** SPEC-045 §7
**Updated:** 2026-04-14

---

## Services Inventory

| Service        | Type            | Host              | Port   | Purpose               |
| -------------- | --------------- | ----------------- | ------ | --------------------- |
| Coolify        | PaaS            | Ubuntu Desktop    | 8000   | Container management  |
| Coolify Proxy  | Reverse Proxy   | Ubuntu Desktop    | 80/443 | SSL termination       |
| Qdrant         | Vector DB       | Coolify           | 6333   | RAG / embeddings      |
| OpenWebUI      | Web UI          | Coolify           | 8080   | Chat interface        |
| Hermes Gateway | Agent           | Ubuntu bare metal | 8642   | Agent brain           |
| Hermes MCP     | MCP Server      | Ubuntu bare metal | 8092   | MCP proxy             |
| Ollama         | LLM Engine      | Ubuntu Desktop    | 11434  | Local inference       |
| LiteLLM        | LLM Proxy       | Docker Compose    | 4000   | Multi-provider proxy  |
| Grafana        | Dashboards      | Docker Compose    | 3100   | Metrics visualization |
| Loki           | Log aggregation | Docker Compose    | 3101   | Centralized logs      |
| Prometheus     | Metrics         | Docker Compose    | 9090   | Metrics collection    |
| MCPO           | MCP Proxy       | Ubuntu bare metal | 8092   | MCP protocol bridge   |
