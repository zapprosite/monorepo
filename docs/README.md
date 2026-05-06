# Nexus Docs (MVP 05/2026)

**Arquitetura de Conhecimento Orientada a Agentes (Mínimo Viável)**

Este repositório adota a estrutura de 3 Pilares Ativos. Todo o ruído histórico foi expurgado para maximizar a densidade de tokens (Token-Efficiency) no Vector DB.

---

## 🧭 Entry Points (Raiz)

Estes são os documentos canônicos para contexto:

| Documento | Uso Principal |
|-----------|---------------|
| [START-HERE.md](./START-HERE.md) | Ponto de entrada para **humanos**. |
| [HOMELAB.md](./HOMELAB.md) | Infraestrutura canônica para **agentes** e inventário real do host. |
| [HARDWARE_HIERARCHY.md](./HARDWARE_HIERARCHY.md) | Resumo curto do padrão de hardware e runtime. |
| [AGENTS.md](./AGENTS.md) | Leis supremas e governança do monorepo. |
| [SECURITY.md](./SECURITY.md) | Diretrizes e checklist de segurança. |

---

## 🏛️ Os 3 Pilares Ativos

A documentação viva do sistema é mantida exclusivamente nestes 3 diretórios:

### 1. `SPECS/` (O que estamos fazendo)
Especificações ativas do Spec-Driven Development. O "estado vivo" do desenvolvimento.
- **Regra:** Todo código novo deve ter uma SPEC.

### 2. `ADRs/` (Por que decidimos assim)
Architecture Decision Records.
- **Regra:** Mudanças estruturais exigem um ADR conciso focando no "Porquê".

### 3. `RUNBOOKS/` (Como operar)
Manuais de operação, SRE e recuperação de desastres.
- **Regra:** Instruções passo a passo (testadas) para mitigar falhas.

---

> *Nota: Diretórios legados (PRDs, GUIDES, INCIDENTS, etc.) foram removidos para reduzir alucinações de IA e inchaço de contexto.*
