---
name: Secrets Audit
description: Scan code for exposed secrets before git push
trigger: /sec
---

# Secrets Audit Skill

Audita código à procura de secrets exposés antes de git push.

## Patterns Detectados

```regex
GitHub Tokens:    (ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}
AWS Keys:         AKIA[0-9A-Z]{16}
Google API:       AIza[0-9A-Za-z_-]{35}
OpenAI Key:       sk-[A-Za-z0-9]{48}
Generic Secret:    (secret|password|api_key|apikey|token)[_-]?['"][A-Za-z0-9+/=]{16,}
Private Key:       -----BEGIN (RSA |EC |DSA |OPENSSH )PRIVATE KEY-----
```

## Output

```markdown
## Secrets Audit

**Scan:** /srv/monorepo
**Found:** 0 secrets

### Secrets
| Type | File | Line | Match |
|------|------|------|-------|
| GitHub Token | src/config.ts | 12 | ghp_xxxx |

### Recommendations
1. Remover imediatamente
2. Usar environment variables
3. Rodar `git secrets --scan` antes de push
```

## Regras

1. Executar SEMPRE antes de git push
2. Se encontrar → CRITICAL, não fazer push
3. Incluir em pre-commit hook
