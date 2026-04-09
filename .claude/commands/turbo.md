---
description: Stage all → semantic commit → push → merge to main → tag → nova feature branch.
---

Stage all → semantic commit → push → merge to main → tag → nova feature branch.

⚠️ AVISO: Execute apenas se .gitignore contém .env e secrets antes de continuar.

Passos:
1. git add -u
2. Analisar diff e criar commit semântico (feat/fix/chore/docs)
3. git push origin HEAD -u
4. Criar PR ou merge direto se branch for feat/*
5. git tag v$(date +%Y%m%d%H%M)
6. git checkout -b feat/next-$(date +%s)
