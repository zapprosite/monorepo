# Retrieval Eval Questions — Brain Refactor (SPEC-VIBE-BRAIN-REFACTOR)

**Date:** 2026-04-24
**Collection:** `will` (Qdrant)
**Scope:** Hermes Agency memory layers — REPO → QDRANT → MEM0

---

## Agentes (Q01-Q04)

### Q01 - CEO Router
**Pergunta:** Como funciona o CEO Router para selects O(1) vs LLM fallback?
**Contexto esperado:** run_agent.py - router logic, trigger conditions O(1) vs LLM
**Resposta ideal:** O CEO Router avalia condicoes de matching O(1) primeiro; se nenhuma corresponder, faz fallback para LLM routing

### Q02 - LangGraph Workflows
**Pergunta:** Quais sao os 6 workflows LangGraph e como usam MemorySaver e HUMAN_GATE?
**Contexto esperado:** toolsets.py ou workflow files - 6 workflows, MemorySaver checkpoint, human_in_the_loop
**Resposta ideal:** 6 workflows (execute_task, analyze_feedback, etc) com MemorySaver para checkpointing e HUMAN_GATE para interrupt

### Q03 - Tool Registry
**Pergunta:** Quantas tools existem no Tool Registry e como funcionam os circuit breakers por tool?
**Contexto esperado:** toolsets.py - 50+ tools, 13 skills, circuit_breaker per-tool
**Resposta ideal:** 50+ tools organizadas em toolsets com circuit breaker pattern - cada tool tem threshold de falhas

### Q04 - Skills Inventory
**Pergunta:** Quais sao os principais skills disponiveis e quais sao seus triggers?
**Contexto esperado:** llms.txt - 101 skills index, ou AGENTS.md - listagem de skills
**Resposta ideal:** 13+ skills ativos (ex: ai-context-sync, brain-analytics, claude_code, coolify_sre, etc) com condicoes de trigger

---

## Servicos (Q05-Q11)

### Q05 - LiteLLM Routing
**Pergunta:** Como esta configurado o LiteLLM router - qual modelo primary e fallback?
**Contexto esperado:** Configuracao LiteLLM - PRIMARY=minimax/MiniMax-M2.7, FALLBACK=ollama/llama3-portuguese, embeddings=nomic
**Resposta ideal:** PRIMARY MiniMax-M2.7, FALLBACK Ollama llama3-portuguese-tomcat-8b, nomic embeddings

### Q06 - Qdrant Collections
**Pergunta:** Quantas colecoes Qdrant existem no Hermes Agency?
**Contexto esperado:** Qdrant collections info - 9 colecoes em Hermes Agency
**Resposta ideal:** 9 colecoes Qdrant em Hermes Agency

### Q07 - Trieve Datasets
**Pergunta:** Quantos datasets Trieve estao configurados e qual usa hybrid search?
**Contexto esperado:** Trieve config - 8 datasets, hybrid search ativado
**Resposta ideal:** 8 datasets Trieve, pelo menos 1 com hybrid search (BM25 + semantic)

### Q08 - Second Brain API
**Pergunta:** Quais sao os endpoints REST do Second Brain API para memory e tasks?
**Contexto esperado:** API routes para memory (save, search, get, delete) e tasks
**Resposta ideal:** Endpoints REST: /memory/save, /memory/search, /memory/get/{id}, /memory/delete/{id}

### Q09 - Redis Usage
**Pergunta:** Para que servem as chaves Redis: rate limiting, locks, session cache e brand cache?
**Contexto esperado:** Redis keys pattern - rate_limit:{user}, lock:{resource}, session:{id}, brand:{slug}
**Resposta ideal:** rate_limit para controle de requests, locks para exclusao mutua, session para cache de sessao, brand para cache de branding

### Q10 - PostgreSQL Schema Pattern
**Pergunta:** Qual e o padrao de nomenclatura de schemas PostgreSQL usado?
**Contexto esperado:** Schema pattern: {app}[_{lead}]
**Resposta ideal:** Padrao {app}[_{lead}] - ex: hvacr, hvacr_lead, crm

### Q11 - Hermes Gateway
**Pergunta:** Qual e o endpoint do Hermes Gateway e como e autenticado?
**Contexto esperado:** hermes.zappro.site:8642, AI_GATEWAY_FACADE_KEY
**Resposta ideal:** hermes.zappro.site:8642 com AI_GATEWAY_FACADE_KEY como Bearer token

---

## Memory Layers (Q12-Q16)

### Q12 - 3-Layer Pattern
**Pergunta:** Qual e o padrao de 3 camadas de memoria e qual a responsabilidade de cada uma?
**Contexto esperado:** REPO (source of truth) -> QDRANT (RAG retrieval) -> MEM0 (preferencias dinamicas)
**Resposta ideal:** REPO=source of truth versionado, QDRANT=vector store para RAG, MEM0=dinamico para preferencias

### Q13 - Mem0 Broken State
**Pergunta:** Qual era o problema do Mem0 e como foi corrigido?
**Contexto esperado:** embedding model mismatch - OPENAI_EMBEDDINGS_MODEL=embedding-nomic
**Resposta ideal:** Embedding model mismatch -> fix com OPENAI_EMBEDDINGS_MODEL=embedding-nomic

### Q14 - Qdrant Metadata Schema
**Pergunta:** Quais sao os 6 campos do metadata schema do Qdrant?
**Contexto esperado:** project, doc_type, service, source_path, updated_at, owner
**Resposta ideal:** project, doc_type, service, source_path, updated_at, owner

### Q15 - Memory Manager Methods
**Pergunta:** Quais sao os metodos do Memory Manager - save, search, get, delete, list_recent?
**Contexto esperado:** Memory Manager class - save(), search(), get(), delete(), list_recent()
**Resposta ideal:** save (persist), search (vector query), get (by id), delete (by id), list_recent (historico)

### Q16 - 3 Entry Points
**Pergunta:** Quais sao os 3 entry points do sistema e o que cada um contem?
**Contexto esperado:** AGENTS.md (instrucoes), llms.txt (indice 101 skills), architecture-map.yaml (mapa C4)
**Resposta ideal:** AGENTS.md=instrucoes agente, llms.txt=repo index (101 skills), architecture-map.yaml=mapa sistema

---

## Arquitetura (Q17-Q20)

### Q17 - Telegram to Agency Data Flow
**Pergunta:** Qual e o fluxo completo de dados desde uma mensagem Telegram ate a resposta da Agency?
**Contexto esperado:** Telegram -> bot -> gateway -> agency -> LLM -> response -> Telegram
**Resposta ideal:** Telegram message -> bot consumer -> Hermes Gateway -> Agency (LangGraph) -> LLM (MiniMax/Ollama) -> gateway -> Telegram

### Q18 - Cron Jobs
**Pergunta:** Quais sao os cron jobs do vibe-brain e qual a periodicidade de cada um?
**Contexto esperado:** vibe-brain-fix (once), vibe-brain-workers (*/15min), vibe-brain-monitor (*/30min)
**Resposta ideal:** vibe-brain-fix (execucao unica), vibe-brain-workers (cada 15min), vibe-brain-monitor (cada 30min)

### Q19 - Coolify Role
**Pergunta:** Qual e o papel do Coolify no ciclo de vida dos containers?
**Contexto esperado:** Coolify para container lifecycle - deploy, scale, health checks, rollback
**Resposta ideal:** Coolify gerencia deploy, scaling, health checks e rollback de containers

### Q20 - MCPO Server
**Pergunta:** O que e o MCPO server na porta 8092 e qual protocolo usa?
**Contexto esperado:** MCPO server em :8092, MCP protocol bridge
**Resposta ideal:** MCPO server em :8092 - MCP protocol bridge para tools/agents

---

## Evaluation Methodology

### Retrieval Test
Para cada pergunta, executar query semantica no Qdrant (top-k=5) e avaliar relevancia dos resultados.

### Metrics
- **Precision@k:** fraction of retrieved results that are relevant
- **Recall@k:** fraction of relevant results that are retrieved (k=5)
- **NDCG:** normalized discounted cumulative gain

### Rubric Scores
| Score | Description |
|-------|-------------|
| 4 | Fully correct - resposta completa com detalhes |
| 3 | Mostly correct - principais pontos corretos, pequeno detalhe faltando |
| 2 | Partially correct - conceito certo, falta profundidade ou precisao |
| 1 | Minimal relevance - algo relacionado mas incorreto |
| 0 | No relevant retrieval |

### Threshold
- **>=75% (>=15/20 Qs com score >=3)** -> PRODUCTION READY
- **50-74%** -> NEEDS IMPROVEMENT
- **<50%** -> NOT READY
