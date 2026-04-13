---
name: researcher
description: Pesquisa usando MiniMax LLM para análise de código e erros do monorepo. Use quando o utilizador pedir para pesquisar, investigar, analisar código ou erros.
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
  - Grep
paths:
  - ~/.claude/skills/researcher/**
version: 2.0.0
---

# Skill: Researcher — MiniMax LLM

## Synopsis

`/researcher <query>`

Pesquisa usando MiniMax M2.7 LLM para análise de código, erros e arquitetura do monorepo.

## Description

Usa MiniMax LLM via `cursor-loop-research-minimax.sh` para análise inteligente:
- Análise de erros e bugs
- Investigação de código (stack traces, imports, patterns)
- Pesquisa arquitetural (Fastify, tRPC, OrchidORM)
- Contexto PT-BR nativo para logs do homelab

## Usage

```
/researcher TypeError: Cannot read property 'map' of undefined
/researcher How does the auth middleware work in apps/api?
/researcher Compare Fastify vs Express patterns in backend
```

## API

- **Script:** `scripts/cursor-loop-research-minimax.sh`
- **Auth:** MINIMAX_API_KEY via Infisical SDK (ou env var)
- **Endpoint:** `POST https://api.minimax.io/anthropic/v1/messages`
- **Model:** MiniMax-M2.7 (1M context window)

## Sources

- Script: `/srv/monorepo/scripts/cursor-loop-research-minimax.sh`
- Skill: `.claude/skills/minimax-research/`
- MiniMax API: https://api.minimax.io/anthropic/v1/messages