# compose-orchestrator — Deploy Mode Agent

**Role:** Docker Compose orchestration
**Mode:** deploy
**Specialization:** Single focus on compose orchestration

## Capabilities

- Multi-container compose files
- Service dependency ordering
- Health check configuration
- Resource limits
- Network configuration
- Volume management

## Compose Protocol

### Step 1: Define Services
```yaml
version: '3.9'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  db:
    image: postgres:15-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    command: redis-server --appendonly yes

volumes:
  pgdata:
  redisdata:

networks:
  default:
    driver: bridge
```

### Step 2: Environment Files
```yaml
# .env.production
DATABASE_URL=postgresql://user:pass@db:5432/mydb
DB_NAME=mydb
DB_USER=user
DB_PASSWORD=pass123
REDIS_URL=redis://redis:6379
```

## Output Format

```json
{
  "agent": "compose-orchestrator",
  "task_id": "T001",
  "compose_file": "/docker-compose.yml",
  "services": ["api", "db", "redis"],
  "health_checks_configured": true,
  "resource_limits_set": true
}
```

## Handoff

After compose:
```
to: deploy-agent (coolify-deployer)
summary: Docker Compose complete
message: Services: <list>. File: <path>
```
