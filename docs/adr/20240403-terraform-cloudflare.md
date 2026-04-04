# ADR 20240403: Gestão de Borda via IaC (Cloudflare & Terraform)

## Contexto
O Homelab 2026 utiliza Cloudflare Tunnels para exposição segura de serviços. Atualmente, a gestão de DNS e a configuração do túnel (`ingress`) é realizada manualmente no arquivo `~/.cloudflared/config.yml`. Isso gera inconsistências entre o estado local (containers) e a borda (Cloudflare) e dificulta a auditoria.

## Decisão
Adotar o padrão de "Infraestrutura como Código" (IaC) para a borda:
1. **Terraform**: Utilizar o provedor oficial da Cloudflare para gerenciar:
   - Registros de DNS (CNAMEs apontando para o túnel).
   - Definições de Túneis e suas configurações de Ingress (futuramente).
2. **Sincronização**: O arquivo `config.yml` local deve ser auditado pela skill `homelab-cloud-governor` para garantir que as portas internas (localhost) correspondam ao ADR 20240401 (Governança de Portas).
3. **Padrão de Nomenclatura**: Todos os subdomínios devem seguir o formato `[servico].[dominio-root].site`.

## Consequências
- Maior agilidade para expor novos microsserviços.
- Registro histórico de mudanças na rede via Git.
- **Desafio**: Exige um `CLOUDFLARE_API_TOKEN` válido e instalado no ambiente de execução.

---
**Status**: Aprovado
**Autor**: Antigravity
