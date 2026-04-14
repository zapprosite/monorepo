---
name: SPEC-042-SPEC-CHUNKING-STRATEGY
description: SPEC-driven development workflow optimized for 204k token context window (MiniMax M2.1) — chunking patterns, context renewal, SPEC chaining
type: specification
status: PROPOSED
priority: critical
author: will-zappro
date: 2026-04-14
specRef: SPEC-024, SPEC-034, SPEC-035, SPEC-036, SPEC-SPEC-AUTOMATOR
---

# SPEC-042: SPEC Chunking Strategy for 204k Token Context

**Target Model:** MiniMax M2.1 (204,800 tokens context window)
**Objective:** Never overflow 204k tokens when implementing large features

---

## Executive Summary

This SPEC defines the **SPEC chunking strategy** — a systematic approach to breaking large feature implementations into token-budgeted SPECs that never exceed the 204k token context window of MiniMax M2.1.

**Key insight:** 204k tokens ≈ 150-200 lines of code + analysis per SPEC chunk. Large features (1000+ lines) must be split across multiple chained SPECs.

---

## 1. Token Budget Model

### 1.1 Token Allocation Per SPEC

| Component                 | Tokens      | Lines (approx) | Purpose                           |
| ------------------------- | ----------- | -------------- | --------------------------------- |
| SPEC metadata + structure | 2,000       | ~80 lines      | Frontmatter, headers, tables      |
| Code implementation       | 80,000      | ~150-200 lines | Actual code to write/modify       |
| Analysis + reasoning      | 40,000      | ~120 lines     | AI thinking, decisions, tradeoffs |
| Tool calls + context      | 40,000      | ~100 calls     | Read, Grep, Bash operations       |
| Memory sync overhead      | 10,000      | ~30 lines      | ai-context-sync integration       |
| Buffer for variance       | 32,000      | ~100 lines     | Error margins, special cases      |
| **TOTAL**                 | **204,000** | **~580 lines** | **Hard cap per SPEC**             |

### 1.2 What Fits in 204k Tokens

**Guaranteed to fit:**

- 1 tRPC router (full CRUD: 150-180 lines)
- 1 React page component (150-200 lines)
- 1 OrchidORM table + migration (120-150 lines)
- 1 skill implementation (100-150 lines)
- 1 API endpoint with tests (200 lines)

**Never fits in single SPEC:**

- Full app (400-800+ lines) → chunk into routers
- Multiple features (500+ lines) → chunk into SPECs
- Monorepo refactors (1000+ lines) → chunk into phases
- Infrastructure changes (600+ lines) → chunk into components

### 1.3 Token Estimation Heuristics

```python
# Token estimation (rough guide)
def estimate_tokens(
    code_lines: int,
    analysis_lines: int = 0,
    tool_calls: int = 0,
    spec_overhead: int = 2000
) -> int:
    """
    Rough token estimation for SPEC chunking.

    Args:
        code_lines: Lines of code to write (1 token ≈ 0.75 words ≈ 4 chars)
        analysis_lines: Lines of reasoning/documentation
        tool_calls: Number of Read/Grep/Bash operations
        spec_overhead: SPEC structure overhead (fixed ~2000 tokens)

    Returns:
        Estimated token count

    Examples:
        estimate_tokens(code_lines=150)           # ~82,000 tokens
        estimate_tokens(code_lines=200, analysis_lines=50)  # ~125,000 tokens
        estimate_tokens(code_lines=150, tool_calls=100)      # ~98,000 tokens
    """
    CODE_TOKENS_PER_LINE = 550      # Average for well-formatted TypeScript
    ANALYSIS_TOKENS_PER_LINE = 350  # Markdown/documentation
    TOOL_CALL_TOKENS = 400         # Per tool invocation overhead

    return (
        spec_overhead +
        (code_lines * CODE_TOKENS_PER_LINE) +
        (analysis_lines * ANALYSIS_TOKENS_PER_LINE) +
        (tool_calls * TOOL_CALL_TOKENS)
    )
```

---

## 2. Chunking Strategies

### 2.1 Feature Size Classification

| Size    | Lines    | SPECs | Strategy                           |
| ------- | -------- | ----- | ---------------------------------- |
| **XS**  | 0-50     | 1     | Single SPEC, direct implementation |
| **S**   | 50-150   | 1     | Single SPEC, standard template     |
| **M**   | 150-300  | 1-2   | Split if >200 lines code           |
| **L**   | 300-600  | 2-3   | Chunk by module/component          |
| **XL**  | 600-1000 | 3-5   | Chunk by layer (API, DB, UI)       |
| **XXL** | 1000+    | 5+    | Chunk by phase + layer             |

### 2.2 Horizontal Chunking (By Layer)

Best for: Full-stack features spanning API + DB + UI

```
Large Feature: User Authentication System (800 lines)
    ├── SPEC-AUTH-01: Database Layer (200 lines)
    │   ├── OrchidORM schema
    │   ├── Migrations
    │   └── Seed data
    ├── SPEC-AUTH-02: API Layer (250 lines)
    │   ├── tRPC routers
    │   ├── Middlewares
    │   └── Validation
    ├── SPEC-AUTH-03: Frontend Layer (250 lines)
    │   ├── Login/Register pages
    │   ├── Auth context
    │   └── Protected routes
    └── SPEC-AUTH-04: Integration + Tests (100 lines)
        ├── E2E tests
        └── Smoke tests
```

### 2.3 Vertical Chunking (By Module)

Best for: Multiple independent features in same layer

```
Large Feature: Dashboard Improvements (500 lines)
    ├── SPEC-DASH-01: Metrics Widgets (150 lines)
    ├── SPEC-DASH-02: Charts Component (150 lines)
    ├── SPEC-DASH-03: Notifications (100 lines)
    └── SPEC-DASH-04: Dashboard Layout (100 lines)
```

### 2.4 Phase-Based Chunking (By Complexity)

Best for: Complex features with dependencies

```
Large Feature: Real-time Collaboration (1200 lines)
    ├── Phase 1: Foundation (SPEC-COLLAB-01, 300 lines)
    │   ├── WebSocket setup
    │   ├── Event types
    │   └── Basic broadcast
    ├── Phase 2: Persistence (SPEC-COLLAB-02, 300 lines)
    │   ├── Message storage
    │   ├── History sync
    │   └── Conflict resolution
    ├── Phase 3: Presence (SPEC-COLLAB-03, 200 lines)
    │   ├── Cursor positions
    │   ├── User indicators
    │   └── Typing indicators
    ├── Phase 4: UI Integration (SPEC-COLLAB-04, 250 lines)
    │   ├── React components
    │   ├── State management
    │   └── Optimistic updates
    └── Phase 5: Polish (SPEC-COLLAB-05, 150 lines)
        ├── Error handling
        ├── Performance optimization
        └── E2E tests
```

---

## 3. Context Renewal Strategy

### 3.1 Renewal Triggers

| Threshold    | Context % | Action                       | Tokens            |
| ------------ | --------- | ---------------------------- | ----------------- |
| **Green**    | 0-60%     | Normal operation             | < 122,880         |
| **Yellow**   | 60-70%    | Prepare for sync             | 122,880 - 143,360 |
| **Orange**   | 70-85%    | **Sync to memory**           | 143,360 - 174,080 |
| **Red**      | 85-95%    | **Checkpoint + sync**        | 174,080 - 194,560 |
| **Critical** | > 95%     | **Full checkpoint + /clear** | > 194,560         |

### 3.2 Renewal Decision Tree

```
Current SPEC context usage:
    │
    ├─> < 70%? ──────────────────→ Continue normally
    │       (Green/Yellow)
    │
    ├─> 70-85%? ─────────────────→ Run ai-context-sync
    │       (Orange)              → Save state to ~/.claude/projects/-srv-monorepo/memory/
    │                               Continue SPEC
    │
    ├─> 85-95%? ─────────────────→ Full checkpoint + sync
    │       (Red)                 → Write SPEC checkpoint to memory/
    │                               Write code state to temp files
    │                               Run ai-context-sync
    │                               Continue if recoverable
    │
    └─> > 95%? ──────────────────→ Commit SPEC + Start new SPEC
            (Critical)            → Write SPEC partial to memory/
            │                      → Git commit (WIP)
            │                      → Create new SPEC with context transfer
            │                      → Continue from checkpoint
            │
            └─> If can't recover ──→ Human intervention required
```

### 3.3 Renewal Implementation

#### Sync Script: `scripts/spec-context-sync.sh`

```bash
#!/usr/bin/env bash
# SPEC Context Sync — Saves current SPEC state to memory
# Usage: bash scripts/spec-context-sync.sh [--full|--incremental]

set -euo pipefail

LOG_FILE="/tmp/spec-context-sync.log"
MEMORY_DIR="$HOME/.claude/projects/-srv-monorepo/memory"
SPEC_DIR="/srv/monorepo/docs/SPECS"

log() { echo "[$(date '+%H:%M:%S')] SPEC-SYNC: $1" | tee -a "$LOG_FILE"; }

sync_spec_checkpoint() {
    local mode="${1:-incremental}"

    log "Starting SPEC context sync (mode: $mode)"

    # 1. Identify current SPEC (from git branch or CLAUDE.md context)
    local current_spec
    current_spec=$(git branch --show-current | grep -o 'SPEC-[0-9]*' | head -1 || echo "UNKNOWN")

    # 2. Extract current state
    local checkpoint_file="$MEMORY_DIR/spec-checkpoints/${current_spec}.checkpoint.md"
    mkdir -p "$(dirname "$checkpoint_file")"

    # 3. Write checkpoint (what was done, what's pending)
    cat > "$checkpoint_file" << EOF
---
name: $(basename "$checkpoint_file" .checkpoint.md)
type: checkpoint
date: $(date -Iseconds)
parent: $current_spec
---

# Checkpoint: $current_spec

## State: $([ "$mode" == "full" ] && echo "FULL" || echo "INCREMENTAL")

## Completed This Session

### Files Modified
$(git diff --name-only HEAD 2>/dev/null || echo "N/A")

### Key Changes
$(git log -1 --format="%s" 2>/dev/null || echo "N/A")

## Pending Tasks (for next session)


## Next Steps
1. Read this checkpoint first
2. Run: \`bash scripts/spec-context-sync.sh --restore $current_spec\`
3. Continue implementation
EOF

    # 4. Sync to memory
    bash "$HOME/.claude/mcps/ai-context-sync/sync.sh" >> "$LOG_FILE" 2>&1

    log "Sync complete: $checkpoint_file"
    echo "$checkpoint_file"
}

restore_spec_checkpoint() {
    local spec_name="$1"
    local checkpoint_file="$MEMORY_DIR/spec-checkpoints/${spec_name}.checkpoint.md"

    if [[ -f "$checkpoint_file" ]]; then
        log "Restoring from checkpoint: $checkpoint_file"
        cat "$checkpoint_file"
        return 0
    else
        log "ERROR: Checkpoint not found for $spec_name"
        return 1
    fi
}

case "${1:-sync}" in
    --full)
        sync_spec_checkpoint "full"
        ;;
    --incremental)
        sync_spec_checkpoint "incremental"
        ;;
    --restore)
        restore_spec_checkpoint "$2"
        ;;
    *)
        sync_spec_checkpoint "incremental"
        ;;
esac
```

---

## 4. ai-context-sync Integration

### 4.1 Sync Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SPEC Chunking + Context Sync                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  SPEC Implementation (204k tokens)                                   │
│  ├── Current SPEC.md                                                 │
│  ├── Code files (read via tools)                                     │
│  └── Analysis state                                                  │
│              │                                                        │
│              │  > 70% context                                         │
│              ↓                                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  scripts/spec-context-sync.sh                                 │   │
│  │  ├── Extracts SPEC state (completed, pending)                 │   │
│  │  ├── Writes checkpoint to memory/                             │   │
│  │  └── Calls ai-context-sync                                    │   │
│  └───────────────────────────────────────────────────────────────┘   │
│              │                                                        │
│              │  ai-context-sync writes to:                            │
│              ↓                                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  ~/.claude/projects/-srv-monorepo/memory/                     │   │
│  │  ├── spec-checkpoints/                                        │   │
│  │  │   └── SPEC-042.checkpoint.md                              │   │
│  │  ├── system_state.md                                          │   │
│  │  ├── user.md                                                  │   │
│  │  └── reference.md                                             │   │
│  └───────────────────────────────────────────────────────────────┘   │
│              │                                                        │
│              │  Next session reads checkpoint first                  │
│              ↓                                                        │
│  New SPEC Session ──→ Restores context from checkpoint               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Memory Structure for SPEC Chaining

```
~/.claude/projects/-srv-monorepo/memory/
├── SPEC-042.checkpoint.md          # Current SPEC state
├── SPEC-042-01.db-layer.md          # Chained SPEC: Database layer
├── SPEC-042-02.api-layer.md         # Chained SPEC: API layer
├── SPEC-042-03.ui-layer.md          # Chained SPEC: UI layer
├── SPEC-042-04.integration.md        # Chained SPEC: Integration
├── project.md                       # Project context
└── reference.md                     # External references
```

### 4.3 ai-context-sync Configuration

**File:** `~/.claude/mcps/ai-context-sync/manifest.json`

```json
{
  "name": "ai-context-sync",
  "version": "2.0.0",
  "sources": [
    {
      "path": "/srv/monorepo/docs/SPECS/",
      "pattern": "SPEC-*.md",
      "target": "~/.claude/projects/-srv-monorepo/memory/",
      "type": "spec-checkpoints"
    },
    {
      "path": "/srv/monorepo/docs/GOVERNANCE/SYSTEM_STATE.md",
      "pattern": "*",
      "target": "~/.claude/projects/-srv-monorepo/memory/",
      "type": "system-state"
    }
  ],
  "sync_interval": "manual",
  "triggers": ["spec-context-sync.sh", "post-commit-hook"]
}
```

---

## 5. SPEC Chaining Patterns

### 5.1 Chaining via Frontmatter

Each SPEC in a chain references its parent and children:

```markdown
---
name: SPEC-042-02-api-layer
description: API Layer for Authentication System
status: PROPOSED
parentSpec: SPEC-042-01-db-layer # <-- Parent SPEC
childSpecs: [SPEC-042-03-ui-layer] # <-- Child SPECs
chainPosition: 2
totalInChain: 4
---

# SPEC-042-02: Authentication API Layer

> **Chain Context:** Part of SPEC-042 Authentication System
>
> - Previous: [SPEC-042-01](SPEC-042-01-db-layer.md) (Database)
> - Next: [SPEC-042-03](SPEC-042-03-ui-layer.md) (UI)
> - Read parent checkpoint first: `~/.claude/projects/-srv-monorepo/memory/SPEC-042-01.checkpoint.md`
```

### 5.2 Chain Index Template

For large features, create a chain index:

```markdown
---
name: SPEC-042-AUTH-CHAIN
description: Chain index for Authentication System
type: chain-index
status: ACTIVE
---

# SPEC-042: Authentication System — Chain Index

**Total SPECs:** 4
**Estimated Total Lines:** 800
**Strategy:** Horizontal chunking (by layer)

## Chain Order

| #   | SPEC        | Layer       | Lines | Status         | Checkpoint                                |
| --- | ----------- | ----------- | ----- | -------------- | ----------------------------------------- |
| 1   | SPEC-042-01 | Database    | 200   | ✅ DONE        | [checkpoint](./SPEC-042-01.checkpoint.md) |
| 2   | SPEC-042-02 | API         | 250   | 🔄 IN PROGRESS | [checkpoint](./SPEC-042-02.checkpoint.md) |
| 3   | SPEC-042-03 | UI          | 250   | 📋 PENDING     | N/A                                       |
| 4   | SPEC-042-04 | Integration | 100   | 📋 PENDING     | N/A                                       |

## Shared Context

### Dependencies

- Database schema from SPEC-042-01
- Zod schemas in `packages/shared/src/auth.ts`

### Key Decisions (propagate through chain)

1. Use bcrypt for password hashing
2. JWT tokens with 7-day expiry
3. Refresh token rotation enabled

## Continuation Protocol

When resuming from checkpoint:

1. Read: `~/.claude/projects/-srv-monorepo/memory/SPEC-042-0X.checkpoint.md`
2. Review: `git diff` for current state
3. Update: SPEC-042-0X status + checkpoint
4. Continue: Implementation
```

### 5.3 Context Transfer Between SPECs

````markdown
## Context Transfer (from SPEC-042-01)

### Completed

- [x] User model in OrchidORM
- [x] Password hashing with bcrypt
- [x] User creation migration

### Implemented Schema

```typescript
// From SPEC-042-01 checkpoint
export const userTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```
````

### For Next SPEC (SPEC-042-02)

- Use `userTable` from shared package
- Implement tRPC procedures for CRUD
- Add auth middleware using JWT

````

---

## 6. Concrete Examples

### Example 1: XS Feature (Fits in 1 SPEC)

**Feature:** Add `isActive` field to User model (30 lines)

```markdown
---
name: SPEC-042-micro
description: Add isActive field to User model
size: XS
estimatedLines: 30
---

# SPEC-042-micro: Add isActive Field

**Size:** XS (single SPEC)
**Tokens:** ~45,000 (well under 204k limit)

## Implementation

### 1. Database (10 lines)
Add column to migration:
\`\`\`sql
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
\`\`\`

### 2. OrchidORM (10 lines)
Update table definition:
\`\`\`typescript
isActive: boolean('is_active').default(true).notNull(),
\`\`\`

### 3. tRPC (10 lines)
Add to user router:
\`\`\`typescript
updateStatus: protectedProcedure
  .input(z.object({ userId: z.string().uuid(), isActive: z.boolean() }))
  .mutation(/* ... */),
\`\`\`
````

### Token Budget Check

- Code: 30 lines × 550 = 16,500 tokens
- Analysis: ~5,000 tokens
- Overhead: 2,000 tokens
- **Total: ~23,500 tokens** ✅

---

### Example 2: M Feature (Needs Splitting)

**Feature:** Complete User Authentication System (400 lines)

**Decision:** Split into 2 SPECs (horizontal by layer)

```
SPEC-AUTH-01: Database + Middleware (200 lines)
SPEC-AUTH-02: API + Frontend (200 lines)
```

**SPEC-AUTH-01:**

```markdown
---
name: SPEC-AUTH-01
parentSpec: null
childSpecs: [SPEC-AUTH-02]
chainPosition: 1
totalInChain: 2
---

# SPEC-AUTH-01: Authentication Database + Middleware

## Size: M (200 lines)

### Database Layer

1. User table (50 lines)
2. Session table (40 lines)
3. Migrations (60 lines)

### Middleware Layer

4. JWT validation (30 lines)
5. Role checks (20 lines)

**Total: 200 lines** ✅
```

**SPEC-AUTH-02:**

```markdown
---
name: SPEC-AUTH-02
parentSpec: SPEC-AUTH-01
chainPosition: 2
totalInChain: 2
---

# SPEC-AUTH-02: Authentication API + UI

> **Chain Context:** Requires SPEC-AUTH-01 complete
> Read: `~/.claude/projects/-srv-monorepo/memory/SPEC-AUTH-01.checkpoint.md`

## Context Transfer from SPEC-AUTH-01

### Available

- `userTable` in database
- `sessionTable` in database
- JWT middleware functions

## Size: M (200 lines)

### API Layer

1. Auth router (60 lines)
2. Login/Logout procedures (50 lines)
3. Register procedure (30 lines)

### UI Layer

4. Auth pages (40 lines)
5. Protected route wrapper (20 lines)

**Total: 200 lines** ✅
```

---

### Example 3: XL Feature (Needs Multi-Phase Chunking)

**Feature:** Real-time Dashboard with WebSockets (1200 lines)

**Decision:** Phase-based chunking (5 SPECs)

```
Phase 1: Foundation (SPEC-DASH-01, 300 lines)
Phase 2: Database (SPEC-DASH-02, 300 lines)
Phase 3: API (SPEC-DASH-03, 250 lines)
Phase 4: UI (SPEC-DASH-04, 250 lines)
Phase 5: Polish (SPEC-DASH-05, 100 lines)
```

**SPEC-DASH-01 (Foundation):**

```markdown
---
name: SPEC-DASH-01
description: WebSocket Foundation
parentSpec: null
childSpecs: [SPEC-DASH-02, SPEC-DASH-03, SPEC-DASH-04, SPEC-DASH-05]
chainPosition: 1
totalInChain: 5
size: XL
estimatedLines: 300
---

# SPEC-DASH-01: WebSocket Foundation

## Scope (300 lines)

### Infrastructure

1. WebSocket server setup (Fastify + ws) - 80 lines
2. Connection manager - 60 lines
3. Event types definition - 40 lines

### Core Logic

4. Broadcast system - 70 lines
5. Reconnection handling - 30 lines

### Testing

6. WebSocket tests - 20 lines

**Token Estimate:**

- Code: 300 × 550 = 165,000
- Analysis: 50 × 350 = 17,500
- Overhead: 2,000
- **Total: ~184,500 tokens** ✅ (under limit)
```

---

## 7. Decision Matrix: When to Chunk

### 7.1 Chunking Triggers

| Condition                        | Action             | Example                                                     |
| -------------------------------- | ------------------ | ----------------------------------------------------------- |
| Feature > 300 lines code         | Chunk horizontally | "Auth system" → DB + API + UI                               |
| Feature > 500 lines code         | Chunk by phase     | "Dashboard" → Foundation → DB → API → UI                    |
| Multiple independent features    | Chunk vertically   | "Dashboard improvements" → Widgets + Charts + Notifications |
| Dependency chain exists          | Chain SPECs        | SPEC-042-01 → 02 → 03                                       |
| Context > 85% mid-implementation | Checkpoint + sync  | Save state, continue if possible                            |
| Context > 95% mid-implementation | Commit + new SPEC  | Partial commit, new SPEC for remainder                      |

### 7.2 Chunking Decision Tree

```
New Feature Request
        │
        ├─> Estimate lines of code
        │
        ├─> < 150 lines? ────────────────────→ Single SPEC ✅
        │
        ├─> 150-300 lines?
        │       │
        │       ├─> Horizontal layers clear? ──→ Split by layer ✅
        │       │
        │       └─> Modules independent? ─────→ Split by module ✅
        │
        ├─> 300-600 lines?
        │       │
        │       └─> Clear phase boundaries? ──→ Phase-based ✅
        │               │
        │               └─> No ──────────────→ Horizontal split ✅
        │
        └─> > 600 lines?
                │
                ├─> Phase-based chunking required ✅
                │
                └─> Create chain index first
```

---

## 8. Monitoring and Enforcement

### 8.1 Token Budget Monitor

````bash
#!/usr/bin/env bash
# spec-token-monitor.sh — Estimates current SPEC token usage
# Usage: bash scripts/spec-token-monitor.sh

set -euo pipefail

# Rough estimation (based on line counts)
estimate_spec_tokens() {
    local spec_file="${1:-}"

    if [[ ! -f "$spec_file" ]]; then
        echo "SPEC file not found: $spec_file"
        return 1
    fi

    # Count markdown lines
    local total_lines
    total_lines=$(wc -l < "$spec_file")

    # Count code blocks
    local code_lines
    code_lines=$(grep -c '```' "$spec_file" | awk '{print $1/2}')

    # Estimate
    local spec_tokens=$((total_lines * 150))
    local code_tokens=$((code_lines * 550))
    local total=$((spec_tokens + code_tokens))

    echo "Estimated tokens: $total"
    echo "Context used: $((total * 100 / 204800))%"

    if [[ $total -gt 184320 ]]; then
        echo "⚠️  WARNING: > 90% context — consider checkpoint"
    elif [[ $total -gt 163840 ]]; then
        echo "🟡 CAUTION: > 80% context — monitor closely"
    else
        echo "🟢 OK: Context within limits"
    fi
}

estimate_spec_tokens "${1:-}"
````

### 8.2 Pre-Commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/usr/bin/env bash
# Pre-commit: Check SPEC token budget

SPECS=$(git diff --cached --name-only | grep 'SPEC.*\.md$' || true)

for spec in $SPECS; do
    tokens=$(bash scripts/spec-token-monitor.sh "$spec" 2>/dev/null | grep "Estimated tokens" | grep -o '[0-9]*')

    if [[ -n "$tokens" ]] && [[ "$tokens" -gt 180000 ]]; then
        echo "❌ SPEC $spec exceeds 180k tokens ($tokens)"
        echo "   Split into smaller SPECs or checkpoint first"
        exit 1
    fi
done
```

---

## 9. Workflow Integration

### 9.1 SPEC Creation Workflow

```
User Request ──→ Size Estimation ──→ Decision Tree ──→ SPEC Creation
                        │                    │
                        ▼                    ▼
                Lines analysis         Chunking strategy
                        │                    │
                        ▼                    ▼
                < 150 lines?         Horizontal / Vertical / Phase
                        │                    │
                   Single SPEC            Multi-SPEC chain
                        │                    │
                        ▼                    ▼
                   Write SPEC          Create chain index
                        │                    │
                        └────────┬───────────┘
                                 │
                                 ▼
                        Implement + Monitor
```

### 9.2 Context Renewal Workflow

```
Implementation ──→ Token Monitor ──→ Threshold Check
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
      < 70%            70-85%            > 85%
        │                 │                 │
    Continue          Sync only        Full checkpoint
        │                 │                 │
        │                 ▼                 │
        │         ai-context-sync           │
        │                 │                 │
        │                 └──────┬──────────┘
        │                        │
        │                   Continue?
        │                        │
        └────────────────────────┼─────────────────┐
                                 │                 │
                               Yes                No
                                 │                 │
                                 ▼                 ▼
                         Continue         Commit + New SPEC
```

### 9.3 Chain Continuation Workflow

```
Resume from Checkpoint
        │
        ├─→ Read SPEC chain index
        │
        ├─→ Identify next SPEC in chain
        │
        ├─→ Read checkpoint from memory/
        │
        ├─→ Review git diff (what changed)
        │
        ├─→ Update SPEC status
        │
        ├─→ Continue implementation
        │
        └─→ Monitor token budget
```

---

## 10. Success Criteria

| #    | Criterion                                       | Verification                                 |
| ---- | ----------------------------------------------- | -------------------------------------------- |
| SC-1 | SPECs never exceed 204k tokens                  | Token monitor script returns < 90%           |
| SC-2 | Large features split into chains                | SPECs have parentSpec/childSpecs             |
| SC-3 | Chain index created for multi-SPEC features     | Chain index exists in memory/                |
| SC-4 | Checkpoints saved on renewal                    | Checkpoint files in memory/spec-checkpoints/ |
| SC-5 | Context transfers between chained SPECs         | SPECs have "Context Transfer" sections       |
| SC-6 | Token monitor integrated in workflow            | Pre-commit hook checks token budget          |
| SC-7 | ai-context-sync configured for SPEC checkpoints | manifest.json includes SPEC sources          |

---

## 11. Files to Create/Modify

| File                                           | Action | Purpose                      |
| ---------------------------------------------- | ------ | ---------------------------- |
| `docs/SPECS/SPEC-042-CHUNKING-STRATEGY.md`     | CREATE | This document                |
| `scripts/spec-context-sync.sh`                 | CREATE | SPEC checkpoint + sync       |
| `scripts/spec-token-monitor.sh`                | CREATE | Token budget estimation      |
| `~/.claude/mcps/ai-context-sync/manifest.json` | UPDATE | Add SPEC checkpoint sync     |
| `docs/SPECS/SPEC-TEMPLATE.md`                  | UPDATE | Add chunking fields          |
| `docs/SPECS/SPEC-INDEX.md`                     | UPDATE | Add SPEC chain index section |

---

## 12. Open Questions

| #    | Question                                     | Impact | Priority |
| ---- | -------------------------------------------- | ------ | -------- |
| OQ-1 | Automate chunking suggestion in /spec skill? | High   | Med      |
| OQ-2 | Integration with SPEC-AUTOMATOR?             | Med    | Low      |
| OQ-3 | Token budget enforcement in pre-commit?      | High   | High     |

---

## 13. Decisions Log

| Date       | Decision                                           | Rationale                        |
| ---------- | -------------------------------------------------- | -------------------------------- |
| 2026-04-14 | 204k token budget per SPEC                         | MiniMax M2.1 context window      |
| 2026-04-14 | 3 chunking strategies: horizontal, vertical, phase | Covers all feature types         |
| 2026-04-14 | 70%/90% thresholds for sync/checkpoint             | Based on SPEC-AUTOMATOR research |
| 2026-04-14 | Chain index for multi-SPEC features                | Enables context transfer         |

---

## Appendix A: Token Estimation Cheatsheet

```
Quick Token Estimates (MiniMax M2.1)

Code Type              | Lines | Tokens
-----------------------|-------|--------
Simple tRPC router     | 50    | 27,500
Full CRUD router       | 150   | 82,500
OrchidORM table        | 80    | 44,000
React page component   | 200   | 110,000
Fastify plugin         | 120   | 66,000
Skill implementation   | 100   | 55,000
Test file              | 80    | 44,000
SPEC document          | 200   | 30,000

WARNING: If code > 200 lines, consider splitting
CRITICAL: If code > 300 lines, MUST split
```

---

## Appendix B: Chain Index Template

```markdown
---
name: SPEC-CHAIN-INDEX
description: Chain index for [Feature Name]
type: chain-index
parentSpec: null
---

# [Feature Name] — Chain Index

## Overview

- **Total SPECs:** N
- **Strategy:** [Horizontal/Vertical/Phase]
- **Status:** [ACTIVE/COMPLETED]

## Chain

| #   | SPEC | Size | Lines | Status | Checkpoint |
| --- | ---- | ---- | ----- | ------ | ---------- |
| 1   |      |      |       |        |            |
| 2   |      |      |       |        |            |
| N   |      |      |       |        |            |

## Shared Dependencies

- [List shared schemas, types, functions]

## Key Decisions

- [List decisions that propagate through chain]

## Continuation Protocol

1. Read checkpoint from memory/
2. Review git diff
3. Update SPEC status
4. Continue
```

---

**Last updated:** 2026-04-14
**Author:** will-zappro
**Status:** PROPOSED
