# ADR 001: Adoção de Estrutura de Governança Sênior

- **Data**: 2026-03-17
- **Status**: Aceito

## Contexto
O Homelab estava operando com regras git básicas e sem padronização de idioma ou rastreabilidade de decisões.

## Decisão
Implementar um conjunto de 5 regras core (ADR, Infra, Zod-First, Observabilidade, Segurança) e mover o workflow de sincronização para um padrão PT-BR.

## Consequências
- Maior clareza na evolução do projeto.
- Melhor compartilhamento de tipos entre Frontend e Backend.
- Prevenção de vazamento de segredos em repositórios públicos.
