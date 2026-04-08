# ADR 20240401: Otimização de Performance e Definição "Thin Desktop" (Homelab 2026)

## Contexto
O Ubuntu Desktop 24.04, em sua instalação padrão, inclui diversos serviços e aplicações focados em produtividade de escritório e entretenimento (LibreOffice, Thunderbird, Jogos). Em um cenário de Homelab voltado para IA e microsserviços, esses recursos consomem memória, CPU e espaço em disco desnecessariamente.

## Decisão
Adotar o padrão "Thin Desktop" para o Homelab 2026, focando em:
1. **ZRAM**: Migrar do swap tradicional para ZRAM (RAM comprimida) para ganhar performance em workloads de IA (LLMs).
2. **Debloat**: Remover aplicações de escritório e mídia que não rodam em containers.
3. **Serviços Críticos**: Desativar `bluetooth`, `cups` (impressão), `whoopsie` (crash report) e `avahi-daemon`.
4. **Log Vacuum**: Limitar o armazenamento de logs do `journalctl` a 100MB ou 7 dias.

## Consequências
- Aumento de memória disponível para modelos Ollama e Qdrant.
- Redução de processos em background e latência de IO.
- **Nota**: A funcionalidade de impressão e bluetooth será desativada por padrão, exigindo reativação manual se necessário.

---
**Status**: Aprovado (SOTA 2026.2)
**Autor**: Antigravity
