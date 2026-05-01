# Claude Events — Cross-CLI Event Bridge

Sistema de eventos cross-CLI para coordenar entre Claude Code, OpenCode e outros agentes no monorepo.

## Arquitetura

```
.claude-events/
├── config/
│   ├── codex-hooks.json        # Hooks de post-tool-use para Claude Code
│   ├── opencode-config.toml    # Config do OpenCode
│   └── opencode-wrappers/      # Wrappers para OpenCode com providers
│       ├── opencode-original   # OpenCode npm original (isolado)
│       ├── opencode-minimax    # OpenCode Go com MiniMax
│       └── opencode-gpt        # OpenCode Go com GPT Plus
├── scripts/
│   ├── install-links.sh        # Cria symlinks para ~/.local/bin e ~/.codex
│   └── uninstall-links.sh      # Remove symlinks
├── systemd/
│   ├── inotify-watch.service   # Watchdog para detectar eventos
│   └── trigger-bridge.service  # Bridge que despacha para vibe-kit
├── state-manager.py            # Gerenciador de estado e eventos
├── event-emit.sh               # Script helper para emitir eventos
├── inotify-watch.sh            # Watch loop (chama state-manager)
├── trigger-bridge.sh           # Poll loop para despachar tarefas
└── logs/                        # Logs dos servicos
```

## Eventos

| Tipo | Origem | Payload |
|------|--------|---------|
| `TOOL_CALL` | codex-hooks.json | `tool=<tool_name>` |
| `CLAUDE_ACCESS` | inotify-watch | `file=<CLAUDE.md|AGENTS.md>` |
| `QUEUE_CHANGE` | inotify-watch | `file=queue.json` |
| `TASK_TRIGGER` | trigger-bridge | `task_name=<name>` |
| `OPENCODE_BOOT` | wrappers | `cli=<opencode-original|opencode-minimax|opencode-gpt>` |

## Instalacao

```bash
cd /srv/monorepo/.claude-events
./scripts/install-links.sh
```

## Desinstalacao

```bash
cd /srv/monorepo/.claude-events
./scripts/uninstall-links.sh
```

## Systemd Services

```bash
# Habilitar e iniciar
systemctl --user enable inotify-watch.service
systemctl --user enable trigger-bridge.service
systemctl --user start inotify-watch.service
systemctl --user start trigger-bridge.service

# Status
systemctl --user status inotify-watch.service
systemctl --user status trigger-bridge.service

# Logs
journalctl --user -u inotify-watch.service -f
journalctl --user -u trigger-bridge.service -f
```

## Uso do state-manager.py

```bash
# Emitir evento
EVENT_TYPE=TOOL_CALL python3 state-manager.py event TOOL_CALL "tool=Read"

# Listar chaves de estado
python3 state-manager.py list

# Obter eventos de um tipo
python3 state-manager.py get events TOOL_CALL

# Obter todos os eventos
python3 state-manager.py get events
```

## Fluxo

1. `inotify-watch.sh` monitora `~/.claude/` e `/srv/monorepo/.claude/` por mudancas em `CLAUDE.md`, `AGENTS.md` e `queue.json`
2. Quando detecta mudanca, emite evento via `state-manager.py event ...`
3. `trigger-bridge.sh` polls `state.json` a cada 5s e despacha `TASK_TRIGGER` para `vibe-kit.sh`
4. `codex-hooks.json` emite `TOOL_CALL` apos cada tool use
5. Wrappers emitem `OPENCODE_BOOT` ao iniciar

## Logs

- `/srv/monorepo/.claude-events/logs/state-manager.log`
- `/srv/monorepo/.claude-events/logs/inotify-watch.log`
- `/srv/monorepo/.claude-events/logs/trigger-bridge.log`
- `/srv/monorepo/.claude-events/logs/event-emit-err.log`
