# /hg — Human gates

## Description

Identify blockers requiring human approval.

## Actions

1. Scan current task list for blocked items
2. Check for dangerous operations (ZFS, firewall, network)
3. Flag items needing explicit confirmation
4. Present blocker summary with required approvers

## Gates Requiring Human Approval

- Service restart/stop
- ZFS operations
- Firewall changes
- Port additions
- Subdomain creation
- Reboot/poweroff

## When

- Before any dangerous operation
- During `/ship` checklist

## Refs

- `GUARDRAILS.md` forbidden actions
- `PORTS.md` port governance
- `SUBDOMAINS.md` subdomain governance
