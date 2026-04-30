# Research Insights — Enterprise Pipeline Patterns

## Autonomous Pipeline Enterprise Patterns

- **Insight 1: Orchestration over Choreography for Complex Flows** — Enterprise autonomous pipelines favor orchestrator-based patterns where a central coordinator controls task flow, checkpoints, and rollback. This provides visibility, auditability, and deterministic recovery vs. event-driven choreography which becomes opaque at scale.

- **Insight 2: Stateful Pipeline with Durable Execution** — Autonomous pipelines must persist execution state to durable storage (DB, WAL, queue) before executing each step. This enables resumption after crashes, parallel worker recovery, and causal ordering of tasks.

- **Insight 3: Human-in-the-Loop Checkpoints for Critical Stages** — Enterprise patterns inject manual approval gates at high-risk stages (deploy to prod, data deletion, external API calls). The pipeline pauses, notifies, and resumes only after human or external signal confirmation.

```typescript
// Pipeline checkpoint pattern
interface PipelineStep {
  id: string;
  execute(ctx: PipelineContext): Promise<Result>;
  rollback?(ctx: PipelineContext): Promise<void>;
  requiresApproval?: boolean;
}

async function executePipeline(steps: PipelineStep[], ctx: PipelineContext) {
  for (const step of steps) {
    if (step.requiresApproval) {
      await waitForApproval(step.id);
    }
    saveCheckpoint(ctx, step.id);
    try {
      const result = await step.execute(ctx);
      ctx.results.set(step.id, result);
    } catch (err) {
      await rollbackCompletedSteps(ctx, step.id);
      throw err;
    }
  }
}
```

## Queue Manager Atomic Operations

- **Insight 1: Transactional Outbox Pattern** — Write to an outbox table in the same transaction as business data, then asynchronously drain the outbox to the message queue. This guarantees atomicity: either both the state change and message are committed, or neither.

- **Insight 2: Idempotent Consumers with Deduplication** — Every message consumer must be idempotent. Use `message_id` or content-based hash with Redis/set to track processed messages. This transforms at-least-once queue delivery into effectively-once execution semantics.

- **Insight 3: Explicit ACK After Commit, Not Before** — Acknowledge messages only after the side effect is durably committed (DB write confirmed, not just accepted by application). This prevents message loss on crash-between-ACK-and-commit scenarios.

```typescript
// Idempotent message processing
async function processMessage(queue: Queue, handler: MessageHandler) {
  const msg = await queue.receive();
  const dedupKey = `processed:${msg.messageId}`;

  if (await redis.exists(dedupKey)) {
    await queue.ack(msg); // Already handled, skip
    return;
  }

  await handler(msg);

  await redis.set(dedupKey, "1", { EX: 86400 });
  await queue.ack(msg);
}
```

## Context Isolation Microservice Patterns

- **Insight 1: Context Object Per Request with Explicit Injection** — Pass a `RequestContext` object explicitly through all function calls rather than relying on thread-local or global state. This makes data flow traceable and testable, and prevents cross-tenant contamination in multi-tenant systems.

- **Insight 2: Copy-on-Write Context for Parallel Tasks** — When an autonomous pipeline spawns parallel branches, each branch receives a deep copy of the context. Mutations in one branch do not affect siblings. Merge at a barrier synchronization point.

- **Insight 3: Boundary Protectors with Schema Validation at Entry** — Validate and sanitize context at service boundaries (API entry, queue listener). Reject or scrub fields that violate tenant isolation rules. Do not trust downstream services to enforce your isolation invariants.

```typescript
// Copy-on-write context for parallel execution
function forkContext(parent: PipelineContext): PipelineContext {
  return {
    ...parent,
    tenantId: parent.tenantId,
    artifacts: new Map(parent.artifacts),
    secrets: {}, // Secrets NOT copied to child — must be explicitly provisioned
  };
}

async function runParallelSteps(steps: PipelineStep[], ctx: PipelineContext) {
  const children = steps.map(step => {
    const childCtx = forkContext(ctx);
    return step.execute(childCtx);
  });
  const results = await Promise.all(children);
  return mergeResults(results);
}
```

## Retry Backoff Exponential Jitter

- **Insight 1: Full Jitter Beats Equal Jitter and No Jitter** — Use `sleep = random_between(0, min(cap, base * 2^attempt))` (full jitter). This distributes retry load better across clients hitting a recovering service, preventing thundering herd.

- **Insight 2: Decorrelated Jitter for High-Contention Systems** — Track previous sleep value and compute `sleep = min(cap, random_between(base, previousSleep * 3))`. This adapts faster than equal jitter and spreads retries better than capped exponential for high-traffic flows.

- **Insight 3: Set Retry Cap at 60–120 Seconds, Not Infinite** — Never retry indefinitely. Cap retries at a maximum delay (e.g., 2 minutes) and a maximum attempt count. Combine with a circuit breaker so persistent failures open the circuit before retries are exhausted.

```typescript
// Full jitter implementation
function sleepWithFullJitter(attempt: number, base: number = 1000, cap: number = 60000): number {
  const exponential = base * Math.pow(2, attempt);
  const jitter = Math.random() * Math.min(exponential, cap);
  return Math.floor(jitter);
}

// Decorrelated jitter
function sleepWithDecorrelatedJitter(attempt: number, base: number, cap: number, prevSleep: number): number {
  const next = Math.floor(Math.random() * Math.min(cap, prevSleep * 3));
  return Math.max(next, base);
}
```

## Circuit Breaker Pattern

- **Insight 1: Three-State State Machine (Closed/Open/Half-Open)** — Closed (normal): failures accumulate; threshold hit → transition to Open. Open (failing fast): requests fail immediately; timeout expires → transition to Half-Open. Half-Open: allow one test request; success → Closed, failure → Open.

- **Insight 2: Failure Threshold Based on Sliding Window, Not Absolute Count** — Count failures over a sliding time window (e.g., last 60 seconds), not since startup. A service that recovers after 5 failures should reset. This prevents permanent open state after transient issues.

- **Insight 3: Half-Open Probes Should Be Limited** — When in half-open state, allow only N probes (typically 1–3) before deciding. If all probes fail, return to open state immediately. Do not flood a struggling service with repeated probe requests.

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,  // ms to wait before half-open
    private halfOpenProbes: number = 3,
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        this.probeCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```
