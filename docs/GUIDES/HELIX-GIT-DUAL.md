# Helix Editor — Git Dual Push (Gitea + GitHub)

## Quick Setup

### 1. Aliases Globais do Git

Adicione ao `~/.gitconfig`:

```ini
[alias]
    pushall = "!f() { git push origin --all && git push gitea --all; }; f"
    pushfollow = "!f() { git push origin --tags && git push gitea --tags; }; f"
    sync = "!f() { git fetch --all && git pull --rebase origin main && git pushall; }; f"
```

### 2. Verificar Configuração

```bash
git remote -v
# origin  git@github.com:zapprosite/monorepo.git (push)
# gitea  ssh://git@127.0.0.1:2222/will-zappro/monorepo.git (push)
```

### 3. Comandos no Helix

```
:sh git pushall
:sh git pushfollow
:sh git sync
```

## Fluxo de Trabalho

### 1. Feature Branch
```
git checkout -b feature/minha-feature
# ... edits ...
git add .
git commit -m "feat: description"
git pushall
```

### 2. Merge via PR (GitHub UI)
```
https://github.com/zapprosite/monorepo/pull/new/feature/minha-feature
```

### 3. Sincronizar Main Local
```
git checkout main
git pull origin main
git pushall
```

## Autenticação

### GitHub
```bash
gh auth login --token <token>
gh auth setup-git
```

### Gitea (SSH)
```bash
ssh-keygen -t ed25519 -C "will@zapprosite.com"
# Adicionar chave em: https://gitea.zappro.site/user/settings/keys
```

## Dicas Helix

| Comando | Ação |
|---------|------|
| `:sh git status` | Ver status |
| `:sh git log --oneline -10` | Ver commits recentes |
| `:sh git diff` | Ver mudanças |
| `:sh git pushall` | Push para ambos remotos |
| `:sh git stash` | Guardar mudanças temporárias |

## Troubleshooting

### Permission denied (GitHub)
```bash
gh auth status
gh auth refresh -h github.com
```

### Permission denied (Gitea)
```bash
ssh -T git@127.0.0.1 -p 2222
# Adicionar chave SSH se necessário
```

### Push rejeitado
```bash
git fetch --all
git merge origin/main  # Resolver conflitos
git pushall
```
