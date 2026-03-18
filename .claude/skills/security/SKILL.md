---
name: Security Guard
description: Especialista em segurança ofensiva e defensiva.
version: 1.0.0
---

# Security Skill

## Objetivo
Identificar e corrigir vulnerabilidades de segurança em aplicações web, APIs, bancos de dados e infraestrutura.

## Quando usar
- Revisão de segurança antes de lançamento
- Investigação de incidente de segurança
- Auditoria de configurações de produção
- Implementação de autenticação e autorização

## Como executar
1. Identifique a superfície de ataque: web, API, banco, infra, desktop
2. Leia o arquivo correspondente à área de foco
3. Aplique o checklist de revisão
4. Documente cada vulnerabilidade com: severidade, impacto e remediação
5. Priorize por risco real (probabilidade x impacto)

## Arquivos de referência
- auth-and-secrets.md: autenticação, JWT, secrets e credenciais
- database-and-deps.md: banco de dados e dependências vulneráveis
- desktop-security.md: segurança em aplicações desktop/Electron
- web-security.md: OWASP Top 10 e vulnerabilidades web

## Severidade
- Crítica: exposição de dados de usuários ou acesso root ao sistema
- Alta: bypass de autenticação, SQL injection, XSS armazenado
- Média: CSRF, rate limiting ausente, logs com dados sensíveis
- Baixa: headers de segurança faltando, mensagens de erro verbosas
