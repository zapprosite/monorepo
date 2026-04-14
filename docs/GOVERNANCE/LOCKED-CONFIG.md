---
version: 1.0
author: Principal Engineer
date: 2026-04-12
---

# Locked Configuration Mechanism

Critical configuration files require `MASTER_PASSWORD` to unlock for modifications.

## Overview

This system protects critical infrastructure configs from accidental or unauthorized changes by requiring password authentication to unlock them for editing. All unlock events are logged.

## Directory Structure

```
/srv/ops/
├── locked-config/
│   ├── .master.hash      # SHA256 hash of MASTER_PASSWORD (gitignored)
│   └── .lock.state      # Current lock state (unlocked/locked)
├── scripts/
│   ├── unlock-config.sh # Unlock protected files (1 hour session)
│   ├── lock-config.sh   # Re-lock after changes
│   └── verify-locked.sh # Check lock status
└── logs/
    └── unlock.log       # All unlock events
```

## Protected Files

The following files are protected by this mechanism:

- `/srv/monorepo/docker-compose.yml` - Main docker-compose
- `/srv/ops/docker-compose.yml` - Ops docker-compose
- `/srv/ops/stacks/*.yml` - Stack configurations
- `/srv/ops/homelab-monitor/docker-compose.yml` - Monitoring stack
- Files affecting immutable services defined in `IMMUTABLE-SERVICES.md`

## Hash Mechanism

The master password is never stored in plaintext. Only the SHA256 hash is stored:

```
SHA256(MASTER_PASSWORD) -> stored in .master.hash
```

## Unlock Session

1. Run `unlock-config.sh` and enter MASTER_PASSWORD
2. System verifies hash against stored hash
3. If valid, creates `.lock.state` with unlock timestamp
4. Session lasts 1 hour, then auto-locks
5. Run `lock-config.sh` to manually re-lock

## Usage

```bash
# Check if locked or unlocked
./verify-locked.sh

# Unlock for editing (password required)
./unlock-config.sh

# Re-lock after changes
./lock-config.sh
```

## Logs

All unlock events are logged to `/srv/ops/logs/unlock.log`:

```
2026-04-12T10:30:00Z UNLOCKED user=will duration=1h
2026-04-12T11:30:00Z AUTO-LOCKED session=expired
2026-04-12T14:15:00Z UNLOCKED user=will duration=manual
```

## Security Notes

- Hash stored, NOT password
- Password only needed to unlock
- Auto-lock prevents permanent unlocked state
- All events logged for audit
