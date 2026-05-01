# Version-Locked Service Configurations

## Purpose

This directory contains version-locked configurations for critical services. Changes to these files require approval and version bumps.

## Locked Services

| Service | Config File | Version | Last Updated |
|---------|-------------|---------|--------------|
| openwebui-hvac | docker-compose.openwebui.yml | 1.0.0 | 2026-05-01 |
| zappro-litellm | docker-compose.litellm.yml | 1.0.0 | 2026-05-01 |
| hvac-rag-pipe | hvac-rag-pipe.py | 1.0.0 | 2026-05-01 |

## Version Lock Rules

1. **Any change to locked configs must increment version**
2. **Changes must be documented in CHANGELOG**
3. **Approval required from Platform Engineering**
4. **Rollback procedure must be documented**

## Verification

Run verification before deployment:

```bash
# Verify no changes to locked configs
./scripts/verify-locked-configs.sh

# Verify network connectivity
./scripts/verify-network-connectivity.sh

# Verify service health
./scripts/verify-service-health.sh
```

## Emergency Rollback

If a locked config change causes outage:

```bash
# Rollback to previous version
git checkout HEAD~1 -- services/docker-compose.openwebui.yml
docker compose -f services/docker-compose.openwebui.yml up -d
```

## Service Dependency Graph

```
openwebui-hvac
├── zappro-redis :6379 (required for sessions)
├── hvac-rag-pipe :4017 (required for RAG)
│   └── zappro-litellm :4000 (required for LLM)
│       ├── zappro-litellm-db :5432 (required for DB)
│       └── Qdrant :6333 (required for vector search)
│           └── hvac-rag-pipe (queries Qdrant)
└── Google OAuth (external)
```
