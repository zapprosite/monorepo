# Observability Reports

Classification: INTERNAL
Owner: Platform Engineering
Status: canonical seed
Updated: 2026-05-01

The default observability surface for this monorepo is a Markdown SRE summary
that can be read locally and later delivered through Hermes to Telegram
`CEO_REFRIMIX_bot`. This replaces dashboard-first reporting for the current SRE
governance track.

## Principles

- Markdown first: the report must be useful in terminal output and chat.
- No secret output: scripts may check whether env vars are set, but never print values.
- No runtime mutation: report generation is read-only.
- Telegram delivery is a later activation step; this governance pass uses dry-run only.
- Hermes is the preferred delivery boundary when notification sending is enabled.

## Report Sections

- Overall status: `OK`, `WARN`, or `CRITICAL`
- Quality gate summary
- Git working tree summary
- Local artifact status
- Service catalog and risk register pointers
- Backup/restore review pointer
- Nexus/Hermes operational pointers
- Open risks from `RISK_REGISTER.md`

## Commands

```bash
scripts/sre-markdown-report.sh --dry-run
```

`--send` is intentionally not enabled in this pass. A future SPEC should define
the Hermes delivery contract, environment variables, retry behavior, and failure
policy before live Telegram sends are allowed.

## Telegram/Hermes Contract

When enabled later, delivery should use:

- Bot: `CEO_REFRIMIX_bot`
- Token env var: `TELEGRAM_BOT_TOKEN`
- Chat env var: `TELEGRAM_CHAT_ID`
- Optional routing layer: Hermes gateway

The script must never print token or chat values. It may only print whether each
required variable is configured.
