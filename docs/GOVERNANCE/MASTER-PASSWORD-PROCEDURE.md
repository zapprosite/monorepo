---
version: 1.0
author: will-zappro
date: 2026-04-12
---

# Master Password Procedure

## Overview

The master password is the highest-privilege credential in the homelab infrastructure. It is required to unlock the `locked-config` directory before modifying pinned services. Due to its critical nature, the password follows an explicit lifecycle with strict storage and recovery policies.

---

## Lifecycle

### 1. Generation

- **Who can generate:** Only Claude Code CLI
- **Method:** `openssl rand -base64 32`
- **Entropy:** 256-bit cryptographic random
- **Constraint:** Must be generated at initial bootstrap only; never regenerated after initial setup

### 2. Storage

- The password is written by a human to a USB drive as a `.pem` file
- **Never stored digitally** on any host disk, NAS, or cloud storage
- The USB drive is physically stored in a secure location
- Only one copy exists

### 3. Verification

- A SHA256 hash of the password is stored at: `/srv/ops/locked-config/.master.hash`
- Hash verification is performed by `unlock-config.sh` before granting access to locked-config
- Plaintext password is never stored on disk at any point

### 4. Usage

The master password is required for the following operations:

| Operation | Reason |
|-----------|--------|
| Coolify upgrade | Pinned service protection |
| Removing any pinned service | Prevent accidental destruction |
| Adding a new pinned service | Governance approval required |
| Modifying docker-compose of a pinned service | Configuration change control |

### 5. Rotation

**Annual rotation procedure:**

1. Retrieve current `MASTER_PASSWORD` from USB
2. Run `unlock-config.sh` and enter current password
3. Generate new password: `openssl rand -base64 32`
4. Write new password to USB `.pem` file (human writes, never typed into terminal)
5. Update hash: `sha256sum /path/to/usb/master.pem > /srv/ops/locked-config/.master.hash`
6. Run `lock-config.sh`
7. Verify new USB password works with `unlock-config.sh`
8. Destroy old USB file after confirming new password works
9. Log rotation in incident log

---

## Emergency Use Cases

The master password is required during these specific scenarios:

- **Coolify upgrade** requires master password
- **Removing any pinned service** requires master password
- **Adding a new pinned service** requires master password
- **Modifying docker-compose of a pinned service** requires master password

---

## Emergency Procedure

When an emergency requires access to locked-config:

```
1. Human retrieves MASTER_PASSWORD from USB
2. Run: unlock-config.sh → enter password
3. Make required changes (all actions auto-logged)
4. Run: lock-config.sh
   OR
   Auto-lock triggers after 1 hour of inactivity
5. Document all changes in the incident log:
   - Timestamp
   - Operator
   - Changes made
   - Rationale
```

---

## Recovery if USB Lost

**NO RECOVERY POSSIBLE**

If the USB drive containing the master password is lost, stolen, or destroyed:

- The `locked-config` directory cannot be unlocked
- Pinned services cannot be modified
- The datacenter must be rebuilt from scratch
- All pinned services must be redeployed

**This is INTENTIONAL.** The inability to recover is a deliberate security trade-off:

- Eliminates single-point-of-failure attack vector
- Prevents coercion or coercion-adjacent scenarios
- Forces physical security discipline for USB handling
- Guarantees that no digital forensics can extract the password

---

## Files and Locations

| File | Location | Purpose |
|------|----------|---------|
| Password hash | `/srv/ops/locked-config/.master.hash` | Verification |
| Locked config | `/srv/ops/locked-config/` | Pinned service configs |
| Unlock script | `/srv/ops/scripts/unlock-config.sh` | Decrypt and mount |
| Lock script | `/srv/ops/scripts/lock-config.sh` | Re-encrypt and unmount |
| Incident log | `./INCIDENTS.md` | Change documentation |

---

## Security Notes

- The master password is not in any password manager
- The master password is not in any secrets system (Infisical, Vault, etc.)
- The USB containing the password is the only access vector
- All unlock attempts are logged with timestamp and operator identity
- Failed unlock attempts trigger security alerts
