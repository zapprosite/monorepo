# OpenCode + MiniMax M2.7 - Guia Rápido

## Configuração Atual

| Item | Valor |
|------|-------|
| **Modelo** | MiniMax-M2.7 |
| **Provider** | MiniMax API |
| **Bypass** | `permission: allow` (auto-aprove) |

## Arquivos de Configuração

```
~/.config/opencode/
├── config.json        # Config principal + permissions
└── skills/           # 35+ skills instaladas
```

## Comandos Principais

```bash
# Iniciar OpenCode
opencode

# Via CLI com prompt
opencode "sua pergunta"

# Com modelo específico
opencode --model minimax/MiniMax-M2.7 "pergunta"
```

## Atalhos (Leader Key = `Ctrl+X`)

| Atalho | Ação |
|--------|------|
| `Ctrl+X` + `n` | Nova sessão |
| `Ctrl+X` + `c` | Compactar sessão |
| `Ctrl+X` + `l` | Listar sessões |
| `Ctrl+X` + `m` | Listar modelos |
| `Ctrl+P` | Lista de comandos |
| `Tab` | Ciclar agents |
| `Esc` | Interromper |

## Comandos Slash

| Comando | Descrição |
|---------|-----------|
| `/permission allow` | Auto-aprove tudo |
| `/permission ask` | Pergunta sempre |
| `/init` | Inicializar projeto |
| `/undo` | Desfazer última mudança |
| `/redo` | Refazer |
| `/share` | Compartilhar sessão |
| `/connect` | Conectar provider |

## Skills Instaladas

### DevOps/Home Lab
- `autodeploy` - Deploy para Coolify/Dokploy
- `server-diagnostic` - Diagnóstico de servidor
- `system-inventory` - Inventário do sistema
- `tailscale-ssh` - Tailscale SSH
- `drawio` - Diagramas

### GitHub/Versionamento
- `github-cli` - GitHub CLI
- `github-pr` - Conventional commits

### Testes
- `playwright` - E2E testing
- `pytest` - Python tests

### Produtividade
- `brainstorming` - Brainstorming
- `skill-creator` - Criar novas skills
- `test-driven-development` - TDD
- `systematic-debugging` - Debug sistemático

### Utilitários
- `defuddle` - Extrair markdown de web
- `json-canvas` - JSON Canvas
- `gmail` - Gmail integration
- `lm-studio` - LM Studio

## Config JSON Atual

```json
{
  "$schema": "https://opencode.ai/config.json",
  "theme": "opencode",
  "autoshare": false,
  "permission": "allow",
  "model": "minimax/MiniMax-M2.7",
  "provider": {
    "minimax": {
      "npm": "@ai-sdk/minimax",
      "name": "MiniMax",
      "env": ["MINIMAX_API_KEY"],
      "models": {
        "MiniMax-M2.7": {
          "name": "MiniMax M2.7",
          "attachment": true,
          "reasoning": true,
          "tool_call": true
        }
      }
    }
  }
}
```

## Troubleshooting

```bash
# Ver versão
opencode --version

# Ver logs
opencode --print-logs

# Debug mode
opencode --log-level DEBUG

# Limpar cache
rm -rf ~/.cache/opencode
```

## Fontes

- [Docs OpenCode](https://opencode.ai/docs)
- [Permissions](https://opencode.ai/docs/permissions/)
- [Keybinds](https://opencode.ai/docs/keybinds/)
