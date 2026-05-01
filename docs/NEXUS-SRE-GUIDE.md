# Nexus SRE Guide

Classification: INTERNAL
Status: `PLACEHOLDER`
Updated: 2026-05-01

## Active SRE Scope

For Nexus/vibe-kit, SRE currently means:

- Queue health.
- Worker process health.
- Smoke/stress regression.
- Secret-safe diagnostics.
- Protected infra handoff when automation is blocked.

## Active Commands

```bash
bash scripts/vibe.sh --status
bash scripts/vibe-ctl.sh queue
python3 .claude/vibe-kit/queue-manager.py stats
```

## Placeholder Scope

The following are not active guarantees in this guide:

- Autonomous Coolify deployment.
- Cloudflare DNS mutation.
- Tunnel route rewrites.
- Firewall automation.
- On-call paging.
- Grafana dashboards.

Those areas require their own current infra docs and explicit operator approval.

## Escalation

Escalate to human/operator when:

- Task requires secret access.
- Task changes public ingress.
- Coolify API returns unauthenticated due AllowList.
- Queue has frozen protected work.
- Stress test would touch real runtime state.
