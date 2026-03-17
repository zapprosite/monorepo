---
source_tool: antigravity
source_path: .agent/workflows/sincronizar-tudo.md
imported_at: 2026-03-17T07:20:43.832Z
ai_context_version: 0.7.1
---
---\ndescription: Sincronização Git Padrão Sênior (Commit & Push)\n---\n\n# /sincronizar-tudo\n\nEste workflow automatiza o processo de commit e push seguindo as convenções do monorepo.\n\n## Passos\n\n1. Verificar status do git\n2. Adicionar mudanças ao staging\n3. Realizar commit seguindo Conventional Commits\n4. Realizar push para o branch atual\n\n// turbo-all\n### Comandos\n- `git add .`\n- `git commit -m \"feat: sincronização automática de workspace\"` (ajuste a mensagem conforme necessário)\n- `git push origin $(git rev-parse --abbrev-ref HEAD)`\n