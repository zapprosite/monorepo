---
name: ADR-029-INFISICAL-MANDATORY
description: Architecture Decision Record — Infisical SDK mandatory for all secrets access
status: PROPOSED
author: will-zappro
date: 2026-04-12
specRef: SPEC-029-INFISICAL-SDK-MANDATORY.md
---

# ADR-029 — Infisical SDK Mandatory for Secrets

**Status:** PROPOSED
**Date:** 2026-04-12
**Author:** will-zappro

---

## Context

O projeto homelab-monorepo accumulateu múltiplas formas de acesso a secrets:

1. **Plain text files** — `~/.zappro/config/secrets.env` com tokens hardcoded
2. **git-credentials** — tokens expostos em arquivo sem encriptação
3. **os.getenv** dispersos — código usa variáveis de ambiente sem guarantee que vêm do vault
4. **Bootstrap scripts** — algumas ferramentas leem secrets directamente de `.env` files

Esta situação cria:
- **Risk de leak** — tokens em plaintext são um vector de ataque
- **Duplicates** — o mesmo secret em múltiplos lugares, impossível fazer rotate at scale
- **No audit trail** — não há como saber quem acedeu a quê
- **Compliance gap** — políticas de segurança requerem centralização de secrets

---

## Decision

**Infisical SDK é o único meio legítimo** para aceder a secrets de produção.

### Determinants

1. **Centralização** — 100% dos secrets no vault, zero duplicates
2. **Audit trail** — logging de todos os acessos
3. **Rotation** — ability to rotate without code changes
4. **Secret zeroization** — revoke instantly
5. **Versioning** — history of secret changes

### Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **HashiCorp Vault** | Mature, feature-rich | Complex setup, requires infrastructure |
| **AWS Secrets Manager** | AWS-native | Vendor lock-in, not self-hosted |
| **1Password CLI** | User-friendly | No programmatic access, not designed for CI |
| **GitHub Secrets** | Built-in to GitHub | Limited to GitHub Actions, not for local dev |
| **os.getenv pattern** | Simple | No guarantee vault-backed, duplicates, no audit |

### Consequences

**Positive:**
- Zero duplicates of secrets
- Complete audit trail
- Instant rotation capability
- Compliance-ready

**Negative:**
- Requires Infisical account/workspace
- Learning curve for SDK usage
- Legacy code migration effort
- Dependency on Infisical availability

**Neutral:**
- Must maintain INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET credentials

---

## Implementation

Ver **docs/GUIDES/INFISICAL-SDK-PATTERN.md** para guide detalhado.

### Migration Path

```
Phase 1 (Now):
- Create SPEC-029 documents ✅ DONE
- Document exceptions

Phase 2 (This week):
- Update code review rules
- Block hardcoded secrets in pre-commit

Phase 3 (Next sprint):
- Migrate secrets.env tokens to Infisical
- Remove from ~/.zappro/config/secrets.env
- Remove from ~/.git-credentials

Phase 4 (Future):
- Pre-commit hook enforcement
- Automated secret scanning
```

---

## Exceptions

Temporary exceptions allowed with:
- Written justification
- will-zappro approval
- Expiry date (max 30 days)
- Tracking in `docs/GOVERNANCE/EXCEPTIONS.md`

---

## References

- SPEC-029-INFISICAL-SDK-MANDATORY.md
- docs/GOVERNANCE/SECRETS-MANDATE.md
- docs/GUIDES/INFISICAL-SDK-PATTERN.md
- [Infisical Python SDK](https://pypi.org/project/infisical-python/)
- [Infisical Node SDK](https://www.npmjs.com/package/infisical-node)

---

**Authority:** will-zappro
**Review:** Required after 90 days (2026-07-12)
