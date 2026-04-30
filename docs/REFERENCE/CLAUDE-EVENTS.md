# CLAUDE-EVENTS — Sistema de Eventos Cross-CLI

**Status:** Ativo
**Updated:** 2026-04-29

## 1. Purpose

Sistema de eventos que permite comunicação entre múltiplas CLIs de IA (Claude Code, OpenCode, Codex) através de symlinks e watchdogs do sistema de arquivos.

**O que faz:**
- Detecta eventos de boot, acesso a arquivos, mudanças em filas e tool calls
- Mantém estado atômico dos eventos processados (evita duplicatas)
- Dispara ações automatizadas em resposta a eventos do sistema

**Por que existe:**
- Coordena agentes entre diferentes CLIs sem acoplamento direto
- Permite que o Nexus/PREVC workflow responda a eventos do ambiente
- Suporta automação de hooks e triggers baseados em filesystem watch

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Cross-CLI Event System                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐   │
│  │ Claude Code │    │  OpenCode    │    │      Nexus/PREVC       │   │
│  │  (codex)    │    │  (opencode)  │    │     (vibe-kit)         │   │
│  └──────┬──────┘    └──────┬───────┘    └───────────┬─────────────┘   │
│         │                  │                        │                 │
│         │                  │                        │                 │
│         ▼                  ▼                        │                 │
│  ┌──────────────────────────────────────────────────────┐             │
│  │              opencode-wrapper                         │             │
│  │   (symlink → ~/.local/bin/opencode)                   │             │
│  │   Emite OPENCODE_BOOT ao iniciar                      │             │
│  └──────────────────────────────────────────────────────┘             │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────┐             │
│  │              event-emit.sh                            │             │
│  │   EVENT_TYPE=<type> EVENT_DIR=<dir> bash ...         │             │
│  │   Ej: OPENCODE_BOOT, CLAUDE_ACCESS, QUEUE_CHANGE     │             │
│  └──────────────────────────────────────────────────────┘             │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────┐             │
│  │           state-manager.py                            │             │
│  │   fcntl.flock + os.replace para acesso atômico       │             │
│  │   Lê/escreve em ~/.claude/state.json                  │             │
│  └──────────────────────────────────────────────────────┘             │
│                              ▲                                        │
│                              │                                        │
│         ┌────────────────────┼────────────────────┐                   │
│         │                    │                    │                   │
│         ▼                    ▼                    ▼                   │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │inotify-watch│    │ trigger-bridge │    │  event-listen   │           │
│  │ (systemd)   │    │   (systemd)    │    │   (FIFO bus)   │           │
│  └─────────────┘    └─────────────────┘    └─────────────────┘           │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Structure

```
.claude/events/                    # Instalação ativa (gitignored)
├── state-manager.py               # CLI principal — gerenciamento de estado
├── event-emit.sh                  # Emissor de eventos (bash wrapper)
├── event-listen.sh                # Listener FIFO para dispatch
├── inotify-watch.sh               # Watchdog via inotifywait
├── trigger-bridge.sh              # Polling de state.json → vibe-kit
├── inotify-watch.service          # systemd unit
├── trigger-bridge.service         # systemd unit
├── opencode-wrapper               # Wrapper modular para OpenCode CLI
├── state.json                     # Estado atômico (JSON)
├── config/                        # Configurações por CLI
│   ├── codex-hooks.json
│   ├── opencode-config.toml
│   └── opencode-wrappers/
│       ├── opencode-original
│       ├── opencode-minimax
│       └── opencode-gpt
├── scripts/
│   ├── install-links.sh           # Cria symlinks e ativa serviços
│   └── uninstall-links.sh         # Remove symlinks e desativa serviços
├── systemd/                       # Units systemd (source)
│   ├── inotify-watch.service
│   └── trigger-bridge.service
└── logs/                          # Logs de execução

.claude-events/                    # Source no monorepo (git tracked)
├── README.md
├── state-manager.py → symlink para .claude/events/
├── event-emit.sh
├── inotify-watch.sh
├── trigger-bridge.sh
├── scripts/
│   ├── install-links.sh
│   └── uninstall-links.sh
├── config/
└── systemd/
```

---

## 4. Install / Uninstall

### Install

```bash
cd /srv/monorepo
bash .claude-events/scripts/install-links.sh
```

O script:
1. Cria symlinks dos arquivos de config para as localizações originais de cada CLI
2. Configura os wrappers em `opencode-wrappers/`
3. Ativa os serviços systemd `inotify-watch.service` e `trigger-bridge.service`

### Uninstall

```bash
cd /srv/monorepo
bash .claude-events/scripts/uninstall-links.sh
```

Isso:
1. Remove os symlinks criados
2. Desativa os serviços systemd
3. **Não remove** os arquivos de config originais das CLIs (só os symlinks)

### Verificar Instalação

```bash
# Symlinks criados
ls -la ~/.claude/codex/hooks/ 2>/dev/null || echo "dir não existe"
ls -la ~/.config/opencode/ 2>/dev/null || echo "dir não existe"

# Serviços systemd ativos
systemctl --user status inotify-watch.service
systemctl --user status trigger-bridge.service
```

---

## 5. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EVENT_DIR` | `~/.claude/events` | Diretório base do sistema de eventos |
| `CLAUDE_DIR` | `~/.claude` | Diretório home do Claude (pai de `events/`) |

### Exemplo de Uso

```bash
# Emitir evento manualmente
EVENT_DIR=~/.claude/events EVENT_TYPE=TESTING bash ~/.claude/events/event-emit.sh key=value

# Emitir via state-manager.py diretamente
EVENT_DIR=~/.claude/events python3 ~/.claude/events/state-manager.py event TOOL_CALL tool=Read file=CLAUDE.md

# Ver estado atual
EVENT_DIR=~/.claude/events python3 ~/.claude/events/state-manager.py dump
```

---

## 6. Event Types

| Event | Quando Ocorre | Dados |
|-------|--------------|-------|
| `OPENCODE_BOOT` | OpenCode CLI inicia | `cli=<nome-da-cli>` |
| `CLAUDE_ACCESS` | Arquivo CLAUDE.md ou AGENTS.md modificado/acessado | `file=<nome>` |
| `QUEUE_CHANGE` | Arquivo `queue.json` modificado | `file=queue.json` |
| `TOOL_CALL` | Ferramenta chamada por um agent | `tool=<nome>`, `file=<arquivo>` |
| `TASK_TRIGGER` | Nova task disparada para processing | `task_name=<nome>` |

### Estrutura do Evento (state.json)

```json
{
  "version": 1,
  "agents": {},
  "events": {
    "CLAUDE_ACCESS": [
      {
        "timestamp": "2026-04-30T00:49:26Z",
        "data": {
          "file": "AGENTS.md",
          "tool": "Read"
        },
        "seq": "a1b2c3d4"
      }
    ]
  },
  "queue": {}
}
```

---

## 7. state-manager.py CLI Reference

CLI principal para gerenciamento de estado e emissão de eventos.

### Synopsis

```bash
python3 state-manager.py <command> [args]
```

### Commands

#### `event <type> [key=value ...]`

Emite um evento do tipo especificado.

```bash
# Emitir evento simples
python3 state-manager.py event TESTING

# Emitir com dados
python3 state-manager.py event TOOL_CALL tool=Read file=CLAUDE.md

# Via env
EVENT_DIR=~/.claude/events python3 state-manager.py event CLAUDE_ACCESS file=CLAUDE.md
```

#### `get <key> [subkey]`

Lê valor do estado.

```bash
python3 state-manager.py get events
python3 state-manager.py get agents agent-001
```

#### `set <key> <value> [subkey]`

Define valor no estado.

```bash
python3 state-manager.py set agents.agent-001.status running
```

#### `agent-start <agent_id> [--tool <tool>] [--cwd <cwd>]`

Registra início de agent.

```bash
python3 state-manager.py agent-start backend-001 --tool Read --cwd /srv/monorepo
```

#### `agent-complete <agent_id> [result]`

Registra conclusão de agent.

```bash
python3 state-manager.py agent-complete backend-001 "success"
```

#### `queue-status <pending> <running> <done> <failed>`

Atualiza status da fila.

```bash
python3 state-manager.py queue-status 5 2 10 1
```

#### `dump`

Imprime estado completo em JSON.

```bash
python3 state-manager.py dump
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Sucesso |
| 1 | Erro de parsing ou argumento inválido |

---

## 8. Troubleshooting

### Inotify não funciona

```bash
# Verificar se inotify-tools está instalado
which inotifywait || echo "inotifywait não encontrado"

# Testar manualmente
inotifywait -m /srv/monorepo/.git/

# Reiniciar serviço
systemctl --user restart inotify-watch.service
```

### Eventos duplicados

O `state-manager.py` mantém lock atômico para evitar duplicatas. Se houver estado corrompido:

```bash
# Limpar estado (cuidado: perde histórico)
rm ~/.claude/state.json
rm ~/.claude/.events.lock
```

### Logs

```bash
# Logs do systemd (inotify-watch)
journalctl --user -u inotify-watch.service -f

# Logs do systemd (trigger-bridge)
journalctl --user -u trigger-bridge.service -f

# Logs de execução
tail -f ~/.claude/events/logs/inotify-watch.log
tail -f ~/.claude/events/logs/bridge.log
```

### Wrapper OpenCode não funciona

```bash
# Verificar symlink
ls -la ~/.local/bin/opencode

# Testar wrapper manualmente
OPENCODE_BOOT=1 bash ~/.claude/events/opencode-wrapper --version
```

### StateManager falha com "too many symbolic links"

Há um loop de symlinks entre `.claude-events/state-manager.py` e `.claude/events/state-manager.py`. Use o path direto:

```bash
# Usar path real (não o symlink)
python3 /srv/monorepo/.claude/events/state-manager.py dump
```

---

## 9. Relação com Nexus / NEXUS PREVC

O sistema de eventos é o **bridge de comunicação** entre o ambiente host e o Nexus/PREVC workflow.

```
┌─────────────────────────────────────────────────────────────┐
│                    Nexus PREVC Workflow                      │
│  P → R → E → V → C                                          │
│  (Plan → Review → Execute → Verify → Complete)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │  trigger-bridge.sh (polling)
                           │  Lê state.json a cada 5s
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 CLAUDE-EVENTS System                         │
│  inotify-watch.sh ──→ state.json ←── event-emit.sh         │
│                          │                                   │
│                          └──→ trigger-bridge.sh            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │  TASK_TRIGGER events
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   vibe-kit Workers                          │
│  15× mclaude em paralelo                                    │
│  queue.json ← brain-refactor/                               │
└─────────────────────────────────────────────────────────────┘
```

### Integração

| Componente | Função na Integração |
|------------|----------------------|
| `inotify-watch.sh` | Watch de `CLAUDE.md`, `AGENTS.md`, `queue.json` |
| `trigger-bridge.sh` | Poll de `state.json` → dispatch para vibe-kit |
| `queue.json` | Fila de tasks do Nexus (em `~/.claude/brain-refactor/`) |
| `state-manager.py` | Atomic state para eventos e agent status |

### Fluxo

1. **Nexus inicia** → `queue.json` é modificado
2. **inotify detecta** → `CLAUDE_ACCESS` ou `QUEUE_CHANGE` emitidos
3. **trigger-bridge polling** → lê `TASK_TRIGGER` events do state.json
4. **vibe-kit workers** → processam tasks da queue
5. **Agent completa** → `agent-complete` chamado → estado atualizado

---

## 10. See Also

| Doc | O que |
|-----|-------|
| `docs/REFERENCE/NEXUS-SECOND-BRAIN-FLOW.md` | Integração Nexus ↔ Hermes Second Brain |
| `docs/REFERENCE/WORKFLOW.md` | Workflows disponíveis (ship, turbo, spec) |
| `.claude-events/README.md` | Documentação técnica completa do sistema |
| `hermes-second-brain/SOUL.md` | Princípios de segurança do Second Brain |
