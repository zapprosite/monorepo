# Queue-Manager State Machine

## Overview

The queue-manager implements a state machine with four primary states and six valid transitions. Each transition is triggered by a specific event and advances the job through its lifecycle.

---

## ASCII State Diagram

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐    claim      ┌─────────┐   complete   ┌───────┐
    ┌─────── │  pending │ ────────────▶ │ running │ ───────────▶ │  done │
    │        └──────────┘               └─────────┘              └───────┘
    │              ▲                          │
    │              │                          │ complete
    │         unfreeze                       ▼
    │              │                    ┌─────────┐
    │         ┌────────┐                 │ failed  │
    │         │ frozen │◀─── freeze ────┴─────────┘
    │         └────────┘
    │              │
    │              │ retry
    │              └────────▶ (back to pending)
    │
    │         ┌─────────────────────────────┐
    └──────── │      retry loop             │
              └─────────────────────────────┘
```

---

## State Definitions

| State     | Description                                              |
|-----------|----------------------------------------------------------|
| `pending` | Job is queued and awaiting claiming by a worker          |
| `running` | Job has been claimed and is actively being processed     |
| `done`    | Job completed successfully — terminal state             |
| `failed`  | Job encountered an error — may be retried               |
| `frozen`  | Job is paused (e.g., backpressure, manual freeze)       |

---

## State Transition Table

| From       | Event      | To         | Description                                    |
|------------|------------|------------|------------------------------------------------|
| `pending`  | `claim`    | `running`  | Worker picks up the job                        |
| `running`  | `complete` | `done`     | Job finished successfully                      |
| `running`  | `complete` | `failed`   | Job finished with an error                     |
| `failed`   | `retry`    | `pending`  | Job re-queued for another attempt              |
| `pending`  | `freeze`   | `frozen`   | Job paused (backpressure or manual)            |
| `frozen`   | `unfreeze` | `pending`  | Job resumes — goes back to pending queue       |

---

## Valid Transitions

### `pending` → `running` (claim)

- **Trigger:** `claim` event
- **Actor:** Worker process
- **Precondition:** Job is in `pending` state and a worker is available
- **Effect:** Job is assigned to the worker and marked as `running`

```
job.state = 'running'
job.worker_id = worker.id
job.started_at = now()
```

### `running` → `done` (complete)

- **Trigger:** `complete` event with `success: true`
- **Actor:** Worker process
- **Precondition:** Job is in `running` state
- **Effect:** Job is marked as successfully completed

```
job.state = 'done'
job.finished_at = now()
job.exit_code = 0
```

### `running` → `failed` (complete)

- **Trigger:** `complete` event with `success: false`
- **Actor:** Worker process
- **Precondition:** Job is in `running` state and encountered an error
- **Effect:** Job is marked as failed

```
job.state = 'failed'
job.finished_at = now()
job.exit_code = error.exit_code
job.error_message = error.message
```

### `failed` → `pending` (retry)

- **Trigger:** `retry` event
- **Actor:** Queue-manager or external retry handler
- **Precondition:** Job is in `failed` state and retry limit not exceeded
- **Effect:** Job is re-queued in pending state

```
job.state = 'pending'
job.retry_count += 1
job.last_error = error.message
```

### `pending` → `frozen` (freeze)

- **Trigger:** `freeze` event
- **Actor:** Queue-manager (backpressure) or admin command
- **Precondition:** Job is in `pending` state
- **Effect:** Job is frozen — not eligible for claiming until unfrozen

```
job.state = 'frozen'
job.frozen_at = now()
job.freeze_reason = reason
```

### `frozen` → `pending` (unfreeze)

- **Trigger:** `unfreeze` event
- **Actor:** Queue-manager (backpressure relieved) or admin command
- **Precondition:** Job is in `frozen` state
- **Effect:** Job returns to pending queue

```
job.state = 'pending'
job.unfrozen_at = now()
```

---

## Invalid Transitions

Attempting a transition that is not in the valid transitions table results in an error. The queue-manager rejects the event and leaves the job in its current state.

| From       | Event      | Expected Behavior                                           |
|------------|------------|--------------------------------------------------------------|
| `pending`  | `complete` | **Reject.** Job is not running — no completion possible.    |
| `running`  | `claim`    | **Reject.** Job is already claimed by a worker.              |
| `running`  | `freeze`   | **Reject.** Use `complete` first to finish the job.         |
| `running`  | `unfreeze` | **Reject.** Job is not frozen.                              |
| `done`     | any        | **Reject.** `done` is a terminal state — no transitions out. |
| `done`     | `retry`    | **Reject.** Terminal state — job must be re-created.        |
| `failed`   | `freeze`   | **Reject.** Failed jobs go back to `pending` via retry.       |
| `failed`   | `unfreeze` | **Reject.** Frozen state is only for pending jobs.           |
| `frozen`   | `claim`    | **Reject.** Frozen jobs cannot be claimed.                   |
| `frozen`   | `complete` | **Reject.** Job is not running.                              |
| `frozen`   | `retry`    | **Reject.** Must unfreeze first, then retry.                 |

### Error Response

When an invalid transition is attempted, the queue-manager returns:

```json
{
  "error": "invalid_transition",
  "job_id": "abc123",
  "current_state": "running",
  "attempted_event": "freeze",
  "message": "Cannot freeze a running job. Use 'complete' first."
}
```

---

## Event Summary

| Event      | Valid From    | Transitions                   |
|------------|---------------|-------------------------------|
| `claim`    | `pending`     | `pending` → `running`         |
| `complete` | `running`     | `running` → `done` or `failed` |
| `retry`    | `failed`      | `failed` → `pending`          |
| `freeze`   | `pending`     | `pending` → `frozen`          |
| `unfreeze` | `frozen`      | `frozen` → `pending`          |

---

## Terminal States

A state is terminal if no valid outgoing transitions exist:

- **`done`** — Job completed successfully. No further transitions.
- **(no other terminal states)** — All other states have at least one outgoing transition.