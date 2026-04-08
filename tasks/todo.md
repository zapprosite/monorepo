# Tasks — Perplexity-like Browser Agent

**Source:** plan.md (2026-04-08)
**Status:** PENDING — awaiting human review

---

## Slice 1: Setup Projeto + Deps

**SPEC Reference:** SPEC.md §8 Etapa 1

- [ ] **[T-1.1]** Criar diretório `/srv/monorepo/apps/perplexity-agent/`
- [ ] **[T-1.2]** Inicializar projeto uv: `uv init --name perplexity-agent`
- [ ] **[T-1.3]** Adicionar deps: `uv add streamlit browser-use`
- [ ] **[T-1.4]** Instalar Playwright: `uvx browser-use install`
- [ ] **[T-1.5]** Criar estrutura de diretórios (agent/, chrome-profile/)
- [ ] **[T-1.6]** Criar placeholder app.py com "hello world"
- [ ] **[T-1.7]** Gitignore chrome-profile/

**Verification:** `uv run python -c "import streamlit; import browser_use; print('OK')"`

---

## Slice 2: Chrome Profile Setup

**SPEC Reference:** SPEC.md §8 Etapa 2

- [ ] **[T-2.1]** Criar `/srv/monorepo/apps/perplexity-agent/agent/chrome_profile.py`
- [ ] **[T-2.2]** Criar diretório `/srv/data/perplexity-agent/chrome-profile/` (gitignored no projeto)
- [ ] **[T-2.3]** Implementar função para verificar Chrome instalado
- [ ] **[T-2.4]** Documentar como fazer login manual nos sites

**Verification:** `ls -la /srv/data/perplexity-agent/chrome-profile/` OK

---

## Slice 3: Basic Streamlit UI

**SPEC Reference:** SPEC.md §8 Etapa 3

- [ ] **[T-3.1]** Implementar `st.title("Perplexity Agent")`
- [ ] **[T-3.2]** Chat input (`st.chat_input`) para perguntas
- [ ] **[T-3.3]** Chat history display
- [ ] **[T-3.4]** Placeholder para resposta do agent
- [ ] **[T-3.5]** Sidebar com status do browser

**Verification:** `uv run streamlit run app.py --port 4004` → UI carrega

---

## Slice 4: browser-use Agent Integration

**SPEC Reference:** SPEC.md §8 Etapa 4

- [ ] **[T-4.1]** Criar `config.py` com Infisical SDK + `get_minimax_token()`
- [ ] **[T-4.2]** Implementar `agent/browser_agent.py` com ChatOpenAI + MiniMax
- [ ] **[T-4.3]** Configurar `base_url="https://api.minimax.chat/v1"`
- [ ] **[T-4.4]** Configurar `model="MiniMax-M2.7"`
- [ ] **[T-4.5]** Integrar com Streamlit UI (chat input → agent → response)

**Verification:** Agent inicializa sem erro de API

---

## Slice 5: Test — Busca Simples

**SPEC Reference:** SPEC.md §8 Etapa 5

- [ ] **[T-5.1]** Testar busca no DuckDuckGo via agent
- [ ] **[T-5.2]** Verificar que resposta inclui fontes/citations
- [ ] **[T-5.3]** Verificar que não há erros de API (budget, rate limit)
- [ ] **[T-5.4]** Medir latency da resposta

**Verification:** `uv run python -c "from agent.browser_agent import test_search; test_search()"` OK

---

## Slice 6: Test — Sessão Google Autenticada

**SPEC Reference:** SPEC.md §8 Etapa 6

- [ ] **[T-6.1]** Fazer login manual no Google via Chrome profile
- [ ] **[T-6.2]** Testar agent com Chrome profile path
- [ ] **[T-6.3]** Verificar que agent detecta sessão logada
- [ ] **[T-6.4]** Verificar persistência entre restarts

**Verification:** Chrome profile mantém sessão após restart

---

## Slice 7: Coolify Deployment (Inside OpenClaw)

**SPEC Reference:** SPEC.md §8 Etapa 7

- [ ] **[T-7.1]** Adicionar `web` service em `variables.tf` (já feito)
- [ ] **[T-7.2]** Terraform apply para criar ingress rule + DNS
- [ ] **[T-7.3]** Integrar Streamlit ao docker-compose do OpenClaw (porta 4004)
- [ ] **[T-7.4]** Configurar health check na porta 4004
- [ ] **[T-7.5]** Deploy e verificar container running

**Verification:** `curl localhost:4004` → 200

---

## Slice 8: Subdomain + Cloudflare Tunnel

**SPEC Reference:** SPEC.md §8 Etapa 8

- [ ] **[T-8.1]** Terraform apply (já atualizado com `web` service)
- [ ] **[T-8.2]** Verificar DNS + ingress rule criados
- [ ] **[T-8.3]** Configurar Cloudflare Access (OAuth) para web.zappro.site
- [ ] **[T-8.4]** Verificar HTTPS + Access policies

**Verification:** `curl https://web.zappro.site` → 200 (via Cloudflare Access)

---

## Stats

| Slice | Tasks | Priority |
|-------|-------|----------|
| S1 | 7 | CRITICAL |
| S2 | 4 | CRITICAL |
| S3 | 5 | HIGH |
| S4 | 5 | HIGH |
| S5 | 4 | HIGH |
| S6 | 4 | MEDIUM |
| S7 | 6 | HIGH |
| S8 | 4 | HIGH |
| **Total** | **39** | |

---

## Pipeline

```
plan.md → todo.md → SLICE 1-8 → REVIEW → SHIP
```

---

## Dependencies

```
Slice 1 (Setup)
    └── Slice 2 (Chrome Profile)
            └── Slice 3 (Streamlit UI)
                    └── Slice 4 (Agent Integration)
                            ├──→ Slice 5 (Test: Busca)
                            └──→ Slice 6 (Test: Google)
                                    │
Slice 7 (Coolify) ──────────────────┤
        │                            │
Slice 8 (Subdomain) ◄───────────────┘
```
