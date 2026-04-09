Stage tracked → commit semântico → push → PR.

Passos:
1. git add -u (só arquivos já tracked)
2. git diff --staged para revisar
3. git commit -m "$(git diff --staged --quiet && echo 'chore: updates' || git log -1 --format='%s')"
4. git push origin HEAD -u
5. gh pr create --title "$(git log -1 --pretty=%s)" --body "$(git log -1 --pretty=%B)" 2>/dev/null || echo "Crie PR manualmente via UI"
