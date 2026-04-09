# SPEC-012: openclaw-update-discoverer — Corrigir Local Scan

**Status:** DRAFT
**Created:** 2026-04-09
**Problem:** Skill apenas descobre updates externos, ignora skills instalados localmente
**Related:** openclaw-agents-kit (SPEC-010)

---

## Problema

O `openclaw-update-discoverer` scaneia apenas:
- GitHub releases (openclaw/openclaw)
- Docker Hub (coollabsio/openclaw)
- ClawHub (marketplace)

**Ignora completamente:**
- Skills instalados em `/data/workspace/skills/`
- O `openclaw-agents-kit` que acabamos de instalar
- Outros skills locais (qdrant-rag, infra-guide, etc)

O resultado: quando o utilizador pergunta "o que mudou no meu bot?", o skill nao sabe responder sobre o que foi instalado localmente.

---

## User Story

**Como** operador do OpenClaw, **quero** que o bot descubra updates tanto externos quanto locais, **para** saber o que foi instalado, o que mudou, e quando foi atualizado.

---

## O que Existe

### Workspace Skills (local — NAO está a ser scaneado)

```
/data/workspace/skills/
├── doc-librarian/          # Skill de auditoria de docs
├── infra-guide/            # Skill de infraestrutura
├── monorepo-explorer/      # Skill de busca no monorepo
├── openclaw-agents-kit/    # Kit de orquestracao (09/04/2026)
├── openclaw-repo-hunter/   # Skill de busca GitHub
└── qdrant-rag/            # Skill de memoria vetorial
```

### Fontes Externas (JA scaneadas)

- `https://api.github.com/repos/openclaw/openclaw/releases/latest`
- `https://hub.docker.com/v2/repositories/coollabsio/openclaw/tags`
- ClawHub API

---

## Solucao: Dual-Track Discovery

### Mindset: Two Worlds

```
┌─────────────────────────────────────────────────────────────┐
│                    UPDATE DISCOVERER                         │
├─────────────────────────┬───────────────────────────────────┤
│   EXTERNAL TRACK        │      LOCAL TRACK                   │
│   (como funciona hoje)  │      (FALTANDO)                   │
├─────────────────────────┼───────────────────────────────────┤
│ • GitHub releases       │ • /data/workspace/skills/         │
│ • Docker Hub tags       │ • skill.yaml.metadata              │
│ • ClawHub marketplace   │ • Data de instalacao               │
│ • Security patches      │ • Changelog local (se existir)    │
│ • Deprecations          │ • Git log do workspace            │
└─────────────────────────┴───────────────────────────────────┘
```

### Padrao de Metadata para Skills

Cada skill local deve ter um `METADATA.json` opcional:

```json
{
  "name": "openclaw-agents-kit",
  "version": "1.0.0",
  "installed_at": "2026-04-09",
  "source": "local",  // ou "clawhub", "github"
  "author": "will + Claude Code",
  "changelog": [
    {"date": "2026-04-09", "version": "1.0.0", "change": "Initial install"}
  ],
  "files": [
    "SKILL.md",
    "GOVERNANCE-TEMPLATE.md",
    "subagent-pattern.md",
    "identity-patch.py",
    "coolify-access.md",
    "infisical-sdk.md",
    "openclaw-config-template.md"
  ]
}
```

### Scan Local — Algoritmo

```python
def scan_local_skills():
    """Scaneia /data/workspace/skills/ e descobre skills instalados."""
    skills = []

    for skill_dir in Path("/data/workspace/skills/").iterdir():
        if not skill_dir.is_dir():
            continue

        # 1. Ler METADATA.json se existir
        metadata_path = skill_dir / "METADATA.json"
        if metadata_path.exists():
            skills.append(json.loads(metadata_path.read_text()))
        else:
            # 2. Inferir de SKILL.md
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                # Extrai name + description do frontmatter
                frontmatter = parse_frontmatter(skill_md.read_text())
                skills.append({
                    "name": skill_dir.name,
                    "description": frontmatter.get("description", ""),
                    "installed_at": get_dir_mtime(skill_dir),
                    "source": "local",
                    "metadata": "inferred"
                })

    return skills
```

### Output Format (Corrigido)

```
📦 OPENCLAW UPDATE DISCOVERER — 2026-04-09

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 EXTERNAL UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 OpenClaw: 2026.2.6 → 2026.x.x (disponivel)
   └─ Docker tags: 2026.2.6, 2026.2.5, latest

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 LOCAL SKILLS (INSTALADOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  openclaw-agents-kit    │ installed: 2026-04-09 │ 8 files │ NEW!
    └─ Kit de orquestracao: leader + sub-agents, Coolify, Infisical

✅  qdrant-rag              │ installed: ~2026-04-06 │ 1 file
    └─ Semantic search: Qdrant + LiteLLM embeddings

✅  doc-librarian           │ installed: ~2026-04-07 │ 1 file
    └─ Auditoria de docs stale

✅  infra-guide             │ installed: ~2026-04-07 │ 1 file
✅  monorepo-explorer       │ installed: ~2026-04-07 │ 1 file
✅  openclaw-repo-hunter    │ installed: ~2026-04-04 │ 1 file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔 ACTION ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• openclaw-agents-kit — NOVO! Leia SKILL.md para usar
```

---

## Arquitetura do Skill Corrigido

```
/data/workspace/skills/openclaw-update-discoverer/
├── SKILL.md              # Skill principal (atualizar)
├── METADATA.json         # Auto-gerado na instalacao
├── check_updates.py      # Script principal (ATUALIZAR)
└── CHANGELOG.md          # Changelog local
```

### check_updates.py — Funcionalidades

```python
# Funcionalidades a adicionar:

def scan_local_skills():
    """Scaneia /data/workspace/skills/ e retorna lista de skills."""
    # Implementacao: ver algoritmo acima

def get_skill_metadata(skill_path):
    """Ler metadata de skill individual."""
    # Tenta METADATA.json primeiro
    # Fallback: inferir de SKILL.md frontmatter

def format_skill_list(skills):
    """Formata lista de skills para output."""
    # Formato: nome | data | files count | status (NEW/UPDATED/OK)

def check_git_history(skill_path, days=7):
    """Scaneia git log do workspace por mudancas recentes."""
    # git log --since="7 days ago" --oneline -- skill_path

def main():
    # 1. Check external (GitHub, Docker) — JA EXISTE
    external = check_external_updates()

    # 2. Check local skills — NOVO
    local = scan_local_skills()

    # 3. Format output
    print_output(external, local)
```

---

## Plano de Execucao

### 1. Atualizar SKILL.md

Adicionar secao "Local Skills" e "Como funciona":

```markdown
## Fontes de Update

### External (automatico)
- GitHub releases → coollabsio/openclaw
- Docker Hub → coollabsio/openclaw tags
- ClawHub → marketplace (quando disponivel)

### Local (scaneado)
- /data/workspace/skills/ → skills instalados localmente
- git log → mudancas nos ultimos 7 dias
```

### 2. Atualizar check_updates.py

Adicionar `scan_local_skills()` e `format_skill_list()`.

### 3. Criar METADATA.json para openclaw-agents-kit

```json
{
  "name": "openclaw-agents-kit",
  "version": "1.0.0",
  "installed_at": "2026-04-09",
  "source": "local",
  "author": "will + Claude Code",
  "changelog": [
    {"date": "2026-04-09", "version": "1.0.0", "change": "Initial install — 8 files"}
  ],
  "files": [
    "SKILL.md",
    "GOVERNANCE-TEMPLATE.md",
    "subagent-pattern.md",
    "identity-patch.py",
    "coolify-access.md",
    "infisical-sdk.md",
    "openclaw-config-template.md"
  ]
}
```

### 4. Criar METADATA.json para outros skills

Executar script que varre todos os skills e gera METADATA.json automaticamente baseado em SKILL.md frontmatter.

---

## Acceptance Criteria

| # | Criterio | Test |
|---|----------|------|
| AC-1 | `check_updates.py` retorna lista de skills locais | Executar e verificar output |
| AC-2 | Skills sem METADATA.json tem dados inferidos | Verificar qdrant-rag, infra-guide |
| AC-3 | openclaw-agents-kit aparece como NEW (09/04/2026) | Verificar no output |
| AC-4 | Output inclui nome, data install, files count | Verificar formato |
| AC-5 | Git log scaneado para mudancas recentes | `git log --since="7 days"` retorna mudancas |

---

## Edge Cases

| Caso | Comportamento |
|------|---------------|
| Skill sem SKILL.md | Pular com warning |
| /data/workspace/skills/ vazio | Mostrar "Nenhum skill local instalado" |
| Git nao disponivel | Pular git log check, continuar |
| Skill com METADATA.json invalido | Fallback para inferencia |

---

## Dependency Graph

```
check_updates.py (ATUALIZAR)
       │
       ├── scan_local_skills()
       │        │
       │        ├── list /data/workspace/skills/
       │        ├── parse METADATA.json (se existir)
       │        └── infer de SKILL.md frontmatter (fallback)
       │
       ├── check_git_history()
       │        └── git log --since="7 days" -- skills/*
       │
       └── format_output()
                ├── EXTERNAL TRACK (GitHub, Docker)
                └── LOCAL TRACK (skills locais)
```

---

## Files a Modificar

| File | Mudanca |
|------|---------|
| `check_updates.py` | Adicionar `scan_local_skills()`, `format_skill_list()` |
| `SKILL.md` | Atualizar com secao Local Skills |
| `METADATA.json` (novo) | openclaw-agents-kit metadata |
