# Project State
- Status: In Progress
- Active Phase: 1 (Arquitetura de Fidelidade)
- Last Updated: 2026-05-05

## Phase 1 — Implemented
- Lock Inverter: hard-lock em hvac_add_manual.py usando is_inverter_technology + is_blacklisted
- Docling Precision: extract_table_header + preservação de cabeçalho em chunks de tabela
- Source Enforcement: sistema prompt atualizado com regra "NÃO SEI" explícita
- Cross-Check Agent: hvac_crosscheck.py (Nexus Analytical) criado e integrado
- PDF Page Numbers: build_rag_context inclui Pág: N em cada trecho
- Citação Indexada: format_citations + campo citations na resposta da API
