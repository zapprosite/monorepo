# Service Configuration Rules

## Docker Compose Service Rules

### 1. Network Configuration

**RULE: Always specify explicit network membership**

```yaml
# ✅ CORRECT - explicit network
services:
  my-service:
    networks:
      - zappro-lite_default

networks:
  zappro-lite_default:
    external: true

# ❌ WRONG - implied network causes isolation issues
services:
  my-service:
    # No network specified - Docker creates isolated network
```

**RULE: Never mix host network_mode with bridge networks**

```yaml
# ❌ WRONG - host network cannot communicate with other containers
services:
  my-service:
    network_mode: host  # Cannot reach containers by name

# ✅ CORRECT - use bridge networks for inter-container communication
services:
  my-service:
    networks:
      - zappro-lite_default
```

### 2. Redis Configuration

**RULE: Redis hostname must be container name, never localhost**

```yaml
# ✅ CORRECT - container name is resolvable in shared network
environment:
  - REDIS_HOST=homelab-redis
  - REDIS_URL=redis://:PASSWORD@homelab-redis:6379

# ❌ WRONG - localhost in container means the container itself
environment:
  - REDIS_HOST=localhost
  - REDIS_URL=redis://:PASSWORD@localhost:6379
```

**RULE: Always use password-protected Redis**

```yaml
# ✅ CORRECT
- REDIS_URL=redis://:SECRET_PASSWORD@homelab-redis:6379

# ❌ WRONG - no authentication
- REDIS_URL=redis://homelab-redis:6379
```

### 3. Database Configuration

**RULE: DATABASE_URL must use container name for PostgreSQL**

```yaml
# ✅ CORRECT
DATABASE_URL=postgresql://user:pass@litellm-db:5432/dbname

# ❌ WRONG - hostname not resolvable from other networks
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

### 4. Inter-Container Communication

**RULE: Use container names as hostnames in shared network**

```yaml
# ✅ CORRECT - container name resolvable in shared network
environment:
  - OPENAI_API_BASE_URL=http://zappro-litellm:4000/v1
  - QDRANT_URL=http://zappro-qdrant:6333

# ❌ WRONG - localhost not accessible from other containers
environment:
  - OPENAI_API_BASE_URL=http://localhost:4000/v1
```

**RULE: Use host.docker.internal for host-to-container communication**

When a service needs to reach a host service AND container services:

```yaml
# ✅ CORRECT - host.docker.internal reaches host, container name reaches other containers
environment:
  - OPENAI_API_BASE_URL=http://host.docker.internal:4017/v1
  - REDIS_HOST=homelab-redis

# For services on host network (like HVAC pipeline at :4017)
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### 5. Volume Mounts

**RULE: Always use absolute paths for volume mounts**

```yaml
# ✅ CORRECT
volumes:
  - /srv/data/service:/app/data:rw

# ❌ WRONG - relative paths break in docker-compose
volumes:
  - ./data:/app/data
```

**RULE: Config files should be read-only**

```yaml
# ✅ CORRECT - config mounted read-only
volumes:
  - /srv/monorepo/config/service/config.yaml:/app/config.yaml:ro

# ❌ WRONG - writable config can be corrupted
volumes:
  - /srv/monorepo/config/service/config.yaml:/app/config.yaml:rw
```

### 6. Environment Variable Precedence

**RULE: Explicit env > env_file > .env**

```yaml
# Priority (highest to lowest):
# 1. environment: - KEY=value (explicit)
# 2. env_file: - /path/to/file (file)
# 3. .env in working directory (automatic)

# ✅ CORRECT - explicit override
environment:
  - REDIS_HOST=homelab-redis  # This overrides env_file

# ✅ CORRECT - use env_file for common vars
env_file:
  - /srv/monorepo/.env
environment:
  - REDIS_HOST=homelab-redis  # Override specific var
```

### 7. Service Dependency Rules

**RULE: Always document service dependencies**

```yaml
# ✅ CORRECT - dependencies explicit
services:
  my-service:
    depends_on:
      - homelab-redis
      - litellm-db
```

### 8. Health Check Rules

**RULE: Every service must have a healthcheck**

```yaml
# ✅ CORRECT
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 9. Restart Policy

**RULE: Use unless-stopped for critical services**

```yaml
# ✅ CORRECT
restart: unless-stopped

# For non-critical services
restart: on-failure
```

### 10. Network Isolation

**RULE: Only join networks that are required**

```yaml
# ✅ CORRECT - only required networks
networks:
  - zappro-lite_default
  - zappro-infra

# ❌ WRONG - joining all networks increases attack surface
networks:
  - default
  - zappro-lite_default
  - zappro-infra
  - some-other-network
```

## Anti-Patterns (DO NOT USE)

### Pattern 1: localhost in containers
```yaml
# WRONG
environment:
  - DATABASE_URL=postgresql://user:pass@localhost:5432/db
  - REDIS_HOST=localhost
```
**Problem**: localhost in a container refers to the container itself, not the host or other containers.

**Fix**: Use container names (`litellm-db`, `homelab-redis`) as hostnames.

### Pattern 2: Missing network configuration
```yaml
# WRONG - creates isolated network
services:
  my-service:
    image: my-image
```
**Problem**: Docker creates a random isolated network. Container can't reach other services.

**Fix**: Explicitly specify networks and use external networks.

### Pattern 3: Mixing host and bridge networks
```yaml
# WRONG
services:
  my-service:
    network_mode: host
  other-service:
    networks:
      - zappro-lite_default
```
**Problem**: Host mode containers can't communicate with bridge network containers.

**Fix**: Use bridge networks consistently, or use `host.docker.internal` for host access.

### Pattern 4: Storing secrets in docker-compose
```yaml
# WRONG
environment:
  - API_KEY=sk-actual-secret-key
```
**Problem**: Secrets in compose files get committed to git.

**Fix**: Use env_file pointing to gitignored .env files, or use secrets management.
