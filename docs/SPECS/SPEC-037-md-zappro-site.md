---
name: SPEC-037-md-zappro-site
description: Obsidian vault UI accessible via Google OAuth
status: IMPLEMENTED
priority: high
author: Principal Engineer
date: 2026-04-13
specRef: SPEC-025 (version lock), SPEC-026 (git mirror)
---

# SPEC-037: md.zappro.site - Obsidian Vault UI

> **Governance:** Esta spec cria um servico estatico com OAuth Google. Verificar docs/GOVERNANCE/IMMUTABLE-SERVICES.md para services imutaveis.

---

## Objective

Criar a interface web md.zappro.site para visualizacao do vault Obsidian do usuario. A aplicacao e esttica (HTML/JS/CSS) servida por nginx:alpine, com autenticacao Google OAuth via Infisical SDK. O vault local (/home/will/obsidian-vault/) sera servido estaticamente e os arquivos .md serao renderizados com markdown no browser.

---

## Tech Stack

| Component          | Technology                 | Notes                                              |
| ------------------ | -------------------------- | -------------------------------------------------- |
| Web Server         | nginx:alpine               | Container estatico                                 |
| Authentication     | Google OAuth               | Via Infisical SDK (mesmas credenciais do list-web) |
| Markdown Rendering | marked.js                  | Client-side parsing                                |
| Frontend           | Vanilla JS                 | Sem frameworks (estatico)                          |
| Styling            | CSS custom                 | Dark theme (sintaxe Obsidian)                      |
| Vault Path         | /home/will/obsidian-vault/ | Mount no container                                 |

---

## Commands

```bash
# Build local
cd apps/obsidian-web && bash build.sh

# Deploy via Coolify
# (via Coolify MCP ou gitea-coolify-deploy skill)

# Health check
curl -sf https://md.zappro.site/health

# Test local (docker-compose)
cd apps/obsidian-web && docker-compose up
```

---

## Project Structure

```
/srv/monorepo/
└── apps/
    └── obsidian-web/                    # Aplicacao estatica
        ├── index.html                   # UI principal (file browser)
        ├── app.js                      # Logica de navegacao + OAuth
        ├── styles.css                  # Dark theme estilo Obsidian
        ├── markdown.js                 # Renderer de markdown
        ├── auth-callback.html           # Callback OAuth Google
        ├── nginx.conf                  # Configuracao nginx (SPA routing)
        ├── Dockerfile                  # Build do container
        ├── build.sh                    # Script de build
        ├── docker-compose.yml          # Desenvolvimento local
        └── vault/                      # Mount point do vault (gitignore)
```

---

## Vault Structure (PARA)

O vault Obsidian segue a metodologia PARA:

```
/home/will/obsidian-vault/
├── 00-Inbox/              # Capturas rapidas
├── 01-Projects/          # Projetos ativos
├── 02-Areas/              # Responsabilidades continuas
├── 03-Resources/          # Material de referencia
├── 04-Archives/           # Itens arquivados
├── _MOC/                  # Maps of Content
├── _Daily/                # Notas diarias
└── _Templates/           # Templates de notas
```

---

## Deployment

### Infrastructure

| Parameter          | Value                                      |
| ------------------ | ------------------------------------------ |
| Port               | 4081                                       |
| Subdomain          | md.zappro.site                             |
| Cloudflare Access  | —                                          |
| Authentication     | Google OAuth apenas (sem Cloudflare Login) |
| Container Registry | Gitea (mesmo que list-web)                 |

### Cloudflare Tunnel

- Aplicacao exposta via Cloudflare Access
- Sem bypass de login (Google OAuth autentica)
- same policy de list.zappro.site

---

## Google OAuth Flow

```
1. Usuario acessa md.zappro.site
2. Redirecionamento para Google OAuth (via Infisical SDK)
3. Apos login, callback para /auth-callback.html
4. Token armazenado em sessionStorage
5. Todas as requisicoes subsequentes incluem token
```

### Infisical Secrets (OAuth)

| Secret                       | Description                |
| ---------------------------- | -------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`     | Client ID Google Cloud     |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client Secret Google Cloud |

---

## API / Navegacao

### Endpoints (nginx)

| Path                  | Description                    |
| --------------------- | ------------------------------ |
| `/`                   | File browser UI (index.html)   |
| `/auth-callback.html` | OAuth callback handler         |
| `/vault/*`            | Arquivos do vault (protegidos) |
| `/health`             | Health check                   |

### File Browser Features

- [ ] Lista de pastas e arquivos
- [ ] Navegacao hierarquica (breadcrumb)
- [ ] Visualizacao de arquivos .md renderizados
- [ ] Busca de arquivos no vault
- [ ] Ordenacao por nome/data

### Markdown Rendering

- Titulos (h1-h6)
- Listas (ordenadas e nao ordenadas)
- Blocos de codigo com syntax highlighting
- Links internos [[wiki-links]] Obsidian
- Imagens embedadas
- Blockquotes
- Tabelas
- Checkboxes

---

## Success Criteria

| #    | Criterion                                                   | Verification                                         |
| ---- | ----------------------------------------------------------- | ---------------------------------------------------- |
| SC-1 | md.zappro.site acessivel em https://md.zappro.site          | `curl -sf https://md.zappro.site/health` retorna 200 |
| SC-2 | Login Google OAuth obrigatorio (mesmo que list.zappro.site) | Navegar anonimo retorna redirect para Google         |
| SC-3 | File browser exibe estrutura do vault                       | Navegar mostra pastas e arquivos                     |
| SC-4 | Arquivos .md renderizam com estilo markdown                 | Abrir nota mostra markdown formatado                 |
| SC-5 | Navegacao entre pastas funciona                             | Clicar em pasta atualiza view                        |
| SC-6 | Busca encontra arquivos no vault                            | Buscar retorna resultados                            |

---

## Open Questions

| #    | Question                                                    | Impact         | Priority |
| ---- | ----------------------------------------------------------- | -------------- | -------- |
| OQ-1 | Wiki-links [[note]] serao resolvidos para links navegaveis? | UX             | Med      |
| OQ-2 | Backlinks serao exibidos?                                   | Funcionalidade | Low      |

---

## User Story

Como **usuario do vault Obsidian**, quero **acessar minhas notas via browser com autenticacao Google**, para **visualizar e navegar meu vault de qualquer dispositivo**.

---

## Goals

### Must Have (MVP)

- [ ] Aplicacao estatica funcional
- [ ] Autenticacao Google OAuth via Infisical SDK
- [ ] File browser com estrutura PAR
- [ ] Renderizacao de markdown
- [ ] Deploy em md.zappro.site:4081
- [ ] Health check operacional

### Should Have

- [ ] Breadcrumb navigation
- [ ] Search functionality
- [ ] Dark theme estilo Obsidian
- [ ] Wiki-links navegaveis

### Could Have

- [ ] Backlinks display
- [ ] Daily notes calendar
- [ ] Recent files list

---

## Non-Goals

Esta spec NAO cobre:

- Editor de markdown (apenas visualizacao)
- Sincronizacao de notas (vault local apenas)
- Mobile app
- Autenticacao via Cloudflare Access (Google OAuth apenas)
- Modificacao de arquivos

---

## Acceptance Criteria

| #    | Criterion                                      | Test                                               |
| ---- | ---------------------------------------------- | -------------------------------------------------- |
| AC-1 | aplicacao builda com `bash build.sh` sem erros | build.sh retorna exit 0                            |
| AC-2 | docker-compose up inicia aplicacao local       | `curl localhost:4081` retorna index.html           |
| AC-3 | Google OAuth redirect funciona                 | Acessar anonimo redireciona para Google            |
| AC-4 | File browser lista pastas do vault             | `/vault/` retorna lista de pastas                  |
| AC-5 | Arquivos .md renderizam markdown               | `/vault/00-Inbox/nota.md` retorna HTML renderizado |
| AC-6 | Health endpoint responde 200                   | `curl -sf https://md.zappro.site/health`           |
| AC-7 | Search encontra arquivos                       | Buscar "projeto" retorna resultados                |

---

## Dependencies

| Dependency                  | Status    | Notes                       |
| --------------------------- | --------- | --------------------------- |
| OAuth: Google Cloud Console | READY     | Mesmas credenciais list-web |
| Infisical SDK               | READY     | Ja configurado              |
| Cloudflare Tunnel           | READY     | list-web tunnel existente   |
| Port 4081                   | AVAILABLE | Verificar PORTS.md          |
| Subdomain md.zappro.site    | PENDING   | Adicionar SUBDOMAINS.md     |

---

## Decisions Log

| Date       | Decision                              | Rationale                     |
| ---------- | ------------------------------------- | ----------------------------- |
| 2026-04-13 | nginx:alpine para servir static files | Leve e suficiente para app JS |
| 2026-04-13 | marked.js para markdown               | Leve, client-side, sem build  |

---

## Checklist

- [ ] SPEC escrito e revisado
- [ ] Decisoes de arquitetura documentadas
- [ ] Criterios de aceite testaveis
- [ ] Dependencies identificadas
- [ ] Port 4081 verificada em PORTS.md
- [ ] Subdomain verificado em SUBDOMAINS.md
- [ ] Tasks geradas via `/pg`
- [ ] Nao ha segredos hardcoded (usar Infisical)
- [ ] Memory index atualizado (sync.sh)
