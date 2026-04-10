---
name: gitea-access
description: Gitea API integration for Claude Code — list repos, trigger workflows, check CI status, create PRs.
---

# Gitea Access Skill

## Configuração

### 1. Obter Token Gitea

**Opção A — Personal Access Token (recomendado para MCP):**
1. Abrir https://gitea.zappro.site/user/settings/applications
2. Criar novo token com scopes: `repo`, `workflow`, `read:user`
3. Guardar em Infisical: `gitea-access-token`

**Opção B — Usar Runner Registration Token (só para Actions):**
- `GITEA_RUNNER_REGISTRATION_TOKEN` já existe em Infisical
- Não funciona para API normal — só para registo de runners

### 2. Guardar Token em Infisical

```bash
# No teu terminal local, com acesso ao vault:
infisical secrets set gitea-access-token --value="your-token-here"
```

**Project ID Infisical:** `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Environment:** `dev`
**Secret path:** `/`

### 3. Configurar no Claude Code

Adicionar ao `settings.json`:
```json
{
  "mcpServers": {
    "gitea": {
      "command": "npx",
      "args": ["-y", "@masonator/gitea-mcp"],
      "env": {
        "GITEA_BASE_URL": "https://gitea.zappro.site",
        "GITEA_ACCESS_TOKEN": "${GITEA_ACCESS_TOKEN}"
      }
    }
  }
}
```

Ou usar o MCP via script Python directo — ver `.claude/mcp/gitea-mcp.py`.

---

## API Endpoints (Gitea v1.25.5)

### Autenticação
```bash
curl -H "Authorization: token {TOKEN}" https://gitea.zappro.site/api/v1/
```

### Repos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/user/repos` | Lista repos do utilizador |
| GET | `/api/v1/repos/{owner}/{repo}` | Details de um repo |
| POST | `/api/v1/repos/create` | Criar repo |
| GET | `/api/v1/repos/{owner}/{repo}/actions` | List workflows |

### Actions / Workflows
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/repos/{owner}/{repo}/actions/workflows` | Lista workflows |
| POST | `/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispath` | Dispara workflow |
| GET | `/api/v1/repos/{owner}/{repo}/actions/runs` | Lista runs |
| GET | `/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}` | Status de um run |

### Pull Requests
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/repos/{owner}/{repo}/pulls` | Lista PRs |
| POST | `/api/v1/repos/{owner}/{repo}/pulls` | Cria PR |
| GET | `/api/v1/repos/{owner}/{repo}/pulls/{index}` | Detalhes PR |

---

## Tools (MCP)

### gitea_list_repos
Lista todos os repositórios do utilizador.

```json
{"owner": "will-zappro"}
```

### gitea_get_workflow
Obtém detalhes de um workflow.

```json
{"owner": "will-zappro", "repo": "monorepo", "workflow_id": "ci.yml"}
```

### gitea_trigger_workflow
Dispara um workflow manualmente.

```json
{"owner": "will-zappro", "repo": "monorepo", "workflow_id": "ci.yml", "ref": "main", "inputs": {}}
```

### gitea_get_run_status
Verifica o estado de um run.

```json
{"owner": "will-zappro", "repo": "monorepo", "run_id": 123}
```

### gitea_create_pr
Cria um Pull Request.

```json
{"owner": "will-zappro", "repo": "monorepo", "title": "feat: new feature", "head": "feature-branch", "base": "main", "body": "Description"}
```

---

## Integração com Cursor-Loop

O cursor-loop usa Gitea para:
1. Push código (git remote configurado)
2. Trigger CI pipeline
3. Obter status dos testes

**Ficheiro relevante:** `.claude/agents/cursor-loop-giteaai.md`

```python
# Exemplo de uso no cursor-loop
def trigger_gitea_workflow(owner, repo, workflow_id, ref="main"):
    response = requests.post(
        f"https://gitea.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        headers={"Authorization": f"token {GITEA_ACCESS_TOKEN}"},
        json={"ref": ref, "inputs": {}}
    )
    return response.json()
```

---

## Troubleshooting

### 401 Unauthorized
- Token inválido ou expirado
- Criar novo token em https://gitea.zappro.site/user/settings/applications

### 403 Forbidden
- Token não tem scope suficiente
- Adicionar scopes: `repo`, `workflow`

### Gitea Actions não aparece
- Actions podem estar desabilitados no repo
- Verificar `.gitea/workflows/` existe

---

## Referências

- [Gitea API Docs](https://docs.gitea.com/1.25/development/api-usage)
- [Gitea Actions](https://docs.gitea.com/1.25/usage/actions/overview)
