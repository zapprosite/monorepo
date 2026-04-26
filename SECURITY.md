# Security Policy

**Project:** Homelab Monorepo
**Last Updated:** 2026-04-26

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |

---

## Reporting a Vulnerability

### For Security Researchers

We appreciate responsible disclosure of vulnerabilities. Please report security issues through:

1. **GitHub Security Advisories** — Use the [Security Advisories](https://github.com/zapprosite/monorepo/security/advisories) page
2. **Private Disclosure** — Email `security@zappro.site`

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

| Timeline | Action |
|----------|--------|
| < 24 hours | Acknowledge receipt |
| < 7 days | Initial assessment |
| < 30 days | Fix proposed or explanation |

---

## Security Best Practices

### For Contributors

- **Never commit secrets** — Use `.env.example` template
- **Validate input** — Use Zod schemas from `packages/zod-schemas`
- **No hardcoded credentials** — All secrets via environment variables
- **IDOR protection** — Always verify `teamId` ownership

### Infrastructure Rules

- **No port exposure** — Check `PORTS.md` before exposing services
- **ZFS snapshots** — Create before any destructive operation
- **No `force push`** — Protected branches prevent this

---

## Security Reviews

All PRs are scanned for:
- Secrets (gitleaks, TruffleHog)
- License compatibility (dependency-review)
- Code quality (Biome linting)

---

## Incident Response

If you discover a security incident:

1. **DO NOT** open a public issue
2. Email `security@zappro.site` immediately
3. Wait for acknowledgment (< 24h)
4. Coordinate disclosure after fix

---

**Template:** enterprise-template-v2
