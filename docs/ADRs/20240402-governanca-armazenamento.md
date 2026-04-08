# ADR 20240402: Governança de Camadas de Armazenamento (Homelab 2026)

## Contexto
O ecossistema Aurelia/Sovereign lida com dados de alta intensidade (Vetoriais em Qdrant, Logs de n8n, Modelos de LLM). Diferentes tipos de disco (NVMe Gen 5, Gen 3, SATA) oferecem performances variadas. Sem uma governança, dados críticos podem acabar em discos lentos, degradando a performance da IA.

## Decisão
Estabelecer o padrão de camadas (Tiering) para o armazenamento:

1. **Camada 0 (Ultra-Performance - NVMe Gen 5 / Tank)**:
   - Destino: `/srv/data/`, `/srv/models/`, `/srv/docker-data/`.
   - Conteúdo: Bancos de dados (Postgres, Qdrant), Modelos (Ollama), Cache de Apps.
   - Padrão: Snapshots ZFS diários.

2. **Camada 1 (Standard - NVMe Gen 3 / System)**:
   - Destino: `/`, `/home/`, `/usr/bin/`.
   - Conteúdo: Binários do sistema, configurações estáticas (YAMLs sem escrita pesada), scripts.

3. **Camada 2 (Archive - SATA / USB)**:
   - Destino: `/srv/backups/`, `/media/will/Wilprodutor/`.
   - Conteúdo: Snapshots de longa duração, logs históricos, arquivos de mídia estáticos.

## Padronização de Caminhos
Todos os serviços devem montar volumes no padrão:
`/srv/data/[NOME_DO_SERVICO]` - mapeado obrigatoriamente para o Dataset ZFS correspondente no `tank/`.

## Consequências
- Garantia de que a latência de IO não será gargalo para a IA.
- Facilidade de backup: Basta fazer snapshot do dataset ZFS em `/srv/data`.
- **Desafio**: Exige migração manual de volumes existentes que não seguem o padrão.

---
**Status**: Aprovado
**Autor**: Antigravity
