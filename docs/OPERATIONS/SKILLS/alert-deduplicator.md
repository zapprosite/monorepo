# Skill: Alert Deduplicator

**Purpose:** Prevent alert fatigue by grouping similar alerts and suppressing duplicates
**Complexity:** Medium
**Risk:** Low (only affects alert delivery, no system changes)
**Integration:** Works with existing alert_agent.sh

## Problem

When multiple containers fail with the same error (e.g., OCI mount error), the system sends N separate Telegram messages. This causes:
- Alert fatigue
- Message flooding
- Difficult triage (which error matters?)

## Solution: Three-Layer Deduplication

### Layer 1: Alert Fingerprinting
Generate a short hash/fingerprint from:
- Alert level (CRITICAL, ERROR, WARN)
- Alert title (normalized — remove container-specific parts)
- Context category (container_down, gpu_high, etc.)

Example:
```
# These would have SAME fingerprint (same error type):
"Container DOWN: nginx-ratelimit (OCI mount error)"
"Container DOWN: postgres-db (OCI mount error)"
# Fingerprint: "ERROR:container_mount_failed:3" (count=3)

# These would have DIFFERENT fingerprints:
"Container DOWN: nginx-ratelimit (OCI mount error)"
"Container DOWN: nginx-ratelimit (restart loop)"
# Fingerprint: different (different reason)
```

### Layer 2: Smart Grouping
When N alerts (configurable, default=3) have the SAME fingerprint within a short window (5 min):
- Send ONE grouped alert: "🚨 3 containers failed with OCI mount error"
- Include all affected container names
- Mark original alerts as "batched" (still in queue, but already handled)

### Layer 3: Cooldown Suppression
After sending an alert, suppress duplicates for a cooldown period (default=15 min):
- Store: fingerprint → last_sent_timestamp
- Before sending, check if cooldown is active
- If cooldown active, skip sending but keep alert in queue

## Implementation

### Alert Fingerprint Function
```bash
generate_fingerprint() {
    local level="$1"    # CRITICAL|ERROR|WARN
    local title="$2"    # Full title
    local context="$3"  # JSON context (may contain container name)

    # Normalize title: remove specific names, keep error pattern
    local normalized
    normalized=$(echo "$title" | \
        sed 's/:.*$//' |  # Remove after colon (container names, etc)
        sed 's/[0-9]\+//g' |  # Remove numbers
        tr '[:upper:]' '[:lower:]')  # lowercase

    # Extract error category from context
    local category="unknown"
    if echo "$context" | jq -e '.container' > /dev/null 2>&1; then
        if echo "$context" | jq -e '.container | test("oci|mount");' > /dev/null 2>&1; then
            category="container_mount"
        elif echo "$context" | jq -e '.container | test("restart");' > /dev/null 2>&1; then
            category="container_restart"
        fi
    elif echo "$context" | jq -e '.gpu_memory_pct' > /dev/null 2>&1; then
        category="gpu_memory"
    fi

    echo "${level}:${category}"
}
```

### Grouping Logic
```bash
# In main loop, after dequeue_alerts:
declare -A fingerprint_count
declare -A fingerprint_samples

for alert in $alerts; do
    fp=$(generate_fingerprint "$level" "$title" "$context")
    fingerprint_count[$fp]=$(( ${fingerprint_count[$fp]:-0} + 1 ))
    fingerprint_samples[$fp]="$title"  # Keep one sample
done

# If any fingerprint has >= 3 hits, batch them
for fp in "${!fingerprint_count[@]}"; do
    if [[ "${fingerprint_count[$fp]}" -ge 3 ]]; then
        # Send grouped alert
        send_grouped_alert "$fp" "${fingerprint_count[$fp]}" "${fingerprint_samples[$fp]}"
    fi
done
```

## Configuration

```yaml
# In thresholds.yaml or agent config
alert_group_threshold: 3        # Min alerts to group
alert_group_window_minutes: 5   # Time window for grouping
alert_cooldown_minutes: 15      # Cooldown between same alerts
```

## Telegram Grouped Message Format

Instead of:
```
🔴 CRITICAL | nginx-ratelimit DOWN
🔴 CRITICAL | postgres-db DOWN  
🔴 CRITICAL | redis DOWN
```

Send ONE:
```
🔴 CRITICAL | 3 containers DOWN (OCI mount error)

────────────────────────
📋 Container Failure (3 affected)
📝 OCI runtime error: mount failed

Affected:
• nginx-ratelimit
• postgres-db
• redis

🕐 09:22:10 2026-04-05  •  health
```

## Benefits

1. **Reduces noise**: 10 container failures → 1 message
2. **Preserves information**: Grouped message still shows all affected
3. **Smart grouping**: Only groups genuinely similar errors
4. **Cooldown**: Prevents re-sending same alert within cooldown period

## Integration Points

- `alert_agent.sh`: Main alert processing (modifies `process_alert` function)
- `lib.sh`: Add `generate_fingerprint()` helper
- New state file: `${STATE_DIR}/alert_dedup.json` (fingerprint → timestamp)

## Exit Codes

- 0: Normal (alerts processed, deduplicated as needed)
- Changes only affect logging/alert delivery, no system risk
