Cria feature branch, implementa, testa e abre PR.
Uso: /feature <descricao>

⚠️ AVISO: Execute apenas se .gitignore contém .env e secrets antes de continuar.

Passos:
1. git checkout main && git pull
2. git checkout -b feat/<slug-da-descricao>
3. if [ -f "docs/specflow/SPEC-*.md" ]; then implementar seguindo spec; else implementar diretamente; fi
4. pnpm test (se disponivel)
5. pnpm lint
6. git add -u && commit semântico
7. git push origin HEAD -u
8. gh pr create --body "$(git log -1 --pretty=%B)" 2>/dev/null || criar PR via UI
