---
name: researcher
description: Pesquisa profunda de mercado e tecnologia usando Tavily Search API. Use quando o utilizador pedir para pesquisar, investigar, analisar tendências ou obter informações actualizadas da web.
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
  - WebFetch
paths:
  - ~/.claude/skills/researcher/**
version: 1.0.0
---

# Skill: Researcher — Tavily Search

## Synopsis

`/researcher <query>`

Pesquisa rápida na web usando Tavily Search API.

## Description

Usa a Tavily Search API para obter resultados de pesquisa actualizados da web. Ideal para:
- Pesquisar informações actuais (pós-2024)
- Investigar produtos, tecnologias, competidores
- Fact-checking rápido
- Obter links e fontes para citations

## Usage

```
/researcher Claude Code CLI best practices 2026
/researcher Tavily API pricing free tier
/researcher Gemini API quota limits
```

## API

- **Endpoint:** `https://api.tavily.com/search`
- **Method:** POST (JSON body)
- **Auth:** `api_key` no body
- **Key:** TAVILY_API_KEY do vault Infisical

## Sources

- Tavily Docs: https://docs.tavily.com
- Free Tier: 1000 queries/month
- API: https://api.tavily.com/search
