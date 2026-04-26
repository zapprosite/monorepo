# Enterprise Feature Branch

## Como Usar Este Template

```bash
# 1. Criar feature branch
git checkout feature/enterprise-template
git checkout -b feature/enterprise-minha-feature

# 2. Implementar
# ... código enterprise ...

# 3. Ship
git add .
git commit -m "feat: description"
git pushall

# 4. PR → Squash merge para main
```

## Enterprise Checklist

### Security
- [ ] IDOR protection (teamId checks)
- [ ] Input validation (Zod schemas)
- [ ] No hardcoded secrets
- [ ] SSRF protection (se URLs externas)
- [ ] SQL injection prevention

### Code Quality
- [ ] TypeScript strict mode
- [ ] No `any` types
- [ ] Error handling
- [ ] Logging

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Security tests

## Scores Target
| Category | Min Score |
|----------|----------|
| Security | 9/10 |
| Correctness | 8/10 |
| Performance | 7/10 |
| Overall | 8/10 |

## Merge Rules
1. Squash merge only
2. Feature branch delete after merge
3. Changelog updated

---

**Created:** 2026-04-26
**Template:** enterprise-template
