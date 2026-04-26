# SPEC-001: Core Swarm Architecture

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-002, SPEC-003, SPEC-004

---

## Objective

Criar o núcleo do swarm de agentes HVAC-R: controller + pool de workers Go com goroutines, execution graph (DAG), scheduler, orphan watchdog e rebalancer.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Go 1.23+ | Goroutines nativas |
| Redis | Redis 7 | Task board + Pub/Sub |
| HTTP | net/http | Webhook + Admin API |
| Serialization | JSON | task.go structs |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│            SWARM CONTROLLER (Go)            │
│  ┌──────────────────────────────────────┐  │
│  │        EXECUTION GRAPH (DAG)         │  │
│  │  intake → classifier → access_control│  │
│  │     ↓          ↓            ↓        │  │
│  │    rag      billing      memory_pre  │  │
│  │     ↓                                     │  │
│  │   ranking → response → memory_post     │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │           AGENT POOL (goroutines)     │  │
│  │  [intake×2][classifier×2][access×1] │  │
│  │  [rag×3][ranking×2][response×2]      │  │
│  │  [billing×1][memory×1]               │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Project Structure

```
cmd/swarm/main.go          # Bootstrap do swarm
internal/swarm/
  controller.go            # Scheduler + OrphanWatchdog + Rebalancer
  graph.go                 # ExecutionGraph + DAG resolver
  graph_builder.go         # BuildMessageGraph factory
  worker.go                # SwarmWorker (claim, execute, steal, heartbeat)
  task.go                  # SwarmTask struct + JSON
  board.go                 # SSE board endpoint
internal/agents/
  interface.go             # AgentInterface
```

---

## Execution Graph

```go
type ExecutionGraph struct {
    ID     string
    Nodes  map[string]*GraphNode
    Edges  map[string][]string // node_id → depends_on[]
    State  *SharedState
}

type GraphNode struct {
    ID        string
    AgentType string
    Status    NodeStatus // pending|running|completed|failed|skipped
    DependsOn []string
    MaxRetries int
    Timeout    time.Duration
}
```

---

## Commands

```bash
# Development
go run cmd/swarm/main.go

# Build
CGO_ENABLED=1 GOOS=linux go build -o bin/swarm cmd/swarm/main.go

# Test
go test ./... -v -race
```

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Redis 7 | PENDING | Task board + Pub/Sub |
| SPEC-002 | BLOCKED | Redis queues schema |
| SPEC-003 | BLOCKED | Memory layers |

---

## Goals

### Must Have
- [ ] SwarmWorker com loop infinito (claim → execute → heartbeat)
- [ ] ExecutionGraph com resolveReady()
- [ ] Scheduler com 10ms tick
- [ ] OrphanWatchdog com 10s tick
- [ ] AgentInterface implementado

### Should Have
- [ ] RebalanceLoop com 30s tick
- [ ] MetricsCollector

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Worker claim task from Redis queue | BRPOP works |
| AC-2 | Graph resolves dependencies correctly | Unit test |
| AC-3 | Orphan watchdog redistributes orphaned tasks | Integration test |
| AC-4 | SSE board endpoint streams events | curl test |
