# ADR 20240401: Governança de Portas e Serviços Homelab (Ubuntu Desktop)

## Contexto
O ambiente Homelab utiliza Ubuntu Desktop e integra múltiplas ferramentas de IA, monitoramento e produtividade (n8n, Supabase, Qdrant, CapRover, LiteLLM, Ollama, Grafana). É necessário um padrão de portas para evitar conflitos e permitir a gestão via reverse proxy (CapRover).

## Decisão
Estabelecer o seguinte padrão de portas e infraestrutura para o ecossistema:

| Serviço | Porta | Prot. | Papel |
| :--- | :--- | :--- | :--- |
| **CapRover** | 80/443 | HTTP/S | Ingress Principal / PaaS Interface |
| **CapRover UI** | 3000 | HTTP | Dashboard de Gestão (Root) |
| **Grafana** | 3001 | HTTP | Monitoramento e Dashboards (Exposto) |
| **Qdrant** | 6333 | HTTP | Vector Database (REST API) |
| **LiteLLM** | 4000 | HTTP | Proxy de Modelos (OpenAI Compatible) |
| **Ollama** | 11434 | HTTP | Local LLM Engine |
| **n8n** | 5678 | HTTP | Workflow Automation (Padrão) |

### Regras de Subdomínios
- Todos os serviços expostos publicamente via CapRover devem usar o formato: `[servico].[dominio-root].com`.
- Exemplos internos: `grafana.local`, `qdrant.local`.

## Consequências
- **Grafana** deve ser reconfigurado de 3000 para **3001** (conflito com CapRover).
- Todas as novas instâncias devem seguir este mapa para garantir estabilidade e evitar indisponibilidade por sobreposição de sockets.
- O uso de `ufw` deve ser restrito às portas 80, 443 e SSH (22) por padrão, roteando o resto via CapRover.

---
**Status**: Aprovado (SOTA 2026.2)
**Autor**: Antigravity
