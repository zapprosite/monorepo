---
trigger: /auditar
purpose: Revisar decisões passadas
when: Preciso revisar o que foi feito
---

# /auditar — Revisar Decisoes Passadas

## Proposito
Revisar o historico de decisoes, commits, e acoes tomadas no projeto para entender o que foi feito e por que.

## Quando Usar
- "Preciso revisar o que foi feito"
- "O que aconteceu nas ultimas semanas?"
- Auditoria de mudancas
- Entender contexto antes de continuar

## Comandos

### 1. Commits Recentes (30 dias)
```bash
cd /srv/monorepo && git log --since="30 days ago" --format="%h %ad %s" --name-only
```

### 2. Decisoes em SPECs
```bash
cd /srv/monorepo && grep -r "DECISION\|decision:" docs/ SPEC.md 2>/dev/null | head -20
```

### 3. Memoria do Second Brain
```bash
cd /srv/monorepo && cat .claude/memory/*.md 2>/dev/null | tail -50
```

### 4. Tags e Releases
```bash
cd /srv/monorepo && git tag -l | tail -10 && echo "---" && git log --oneline -20
```

### 5. Mudancas em Configuracoes
```bash
cd /srv/monorepo && git log --since="30 days ago" -- "*.yaml" "*.yml" "*.json" "*.md" | grep -E "commit|modified" | head -20
```

## Output Esperado

```
=== Auditoria de Decisoes ===

[COMMIT RECENTES]
| Commit | Data | Mensagem |
|--------|------|----------|
| xxxxxx | YYYY-MM-DD | feat: descricao |

[TECHSPC DECISOES]
- YYYY-MM-DD: [decisao] - descricao
- YYYY-MM-DD: [decisao] - descricao

[RELEASES]
- vX.Y.Z (YYYY-MM-DD)
- vX.Y.Z (YYYY-MM-DD)

[MUDANCAS CONFIG]
- .claude/config.yaml: modificado
- docker-compose.yml: adicionado

RESUMO: X decisoes, Y commits, Z releases
```
