## Ralph Autonomous Mode

Ralph is Flow-Next's autonomous overnight worker.

### Setup
```
/flow-next:ralph-init
```

### How It Works
1. Reads SPEC and current state
2. Creates task queue
3. Works through tasks overnight
4. Reports in morning

### For Monorepo
Use for:
- Large refactors
- Multi-SPEC cleanup
- Overnight improvements

### Safety
- ZFS snapshot before start
- Wake up check every 2h
- Stop on critical error

### Integration with Nexus
Ralph plans, Nexus executes in parallel.
