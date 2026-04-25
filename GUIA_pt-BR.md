# Guia do Monorepo — PT-BR

**Para:** Equipe não-técnica
**Projeto:** homelab.zappro.site
**Atualizado:** 2026-04-25

---

## O que é?

O **monorepo** é como um "depósito central" onde guardamos todo o código do projeto em um só lugar. Pense nele como um armário grande com gavetas organizadas.

### O que tem dentro

| Gaveta (pasta) | O que guarda | Exemplo |
|----------------|--------------|---------|
| `apps/` | Programas que rodam | Site, API |
| `docs/` | Documentação | Guias, especificações |
| `scripts/` | Automação | Backup, verificação |
| `smoke-tests/` | Testes rápidos | Verifica se tudo funciona |

---

## Os 3 Sistemas Principais

### 1. Nexus — Executor de Tarefas

**O que faz:** Executa tarefas automaticamente usando 49 "agentes" (robôs que trabalham juntos).

**Quando usar:** Quando você precisa de algo construído, testado ou implementado.

**Como falar com ele:**
```
bash .claude/vibe-kit/nexus.sh --status      → Ver estado
bash .claude/vibe-kit/nexus.sh --mode list    → Ver todos os agentes
bash .claude/vibe-kit/nexus.sh --mode debug   → Ver agentes de diagnóstico
```

### 2. Hermes — Bot de IA

**O que faz:** Responde mensagens pelo Telegram, gerencia a comunicação.

**Status:** Rodando ✅

**Como verificar:**
```bash
bash smoke-tests/smoke-hermes-ready.sh
```

### 3. Flow-Next — Planejador

**O que faz:** Ajuda a planejar tarefas antes de executar. É como um arquiteto que desenha o projeto primeiro.

**Quando usar:** Quando você tem uma ideia e quer transformar em um plano detalhado.

**Comandos principais:**

| Comando | O que faz |
|---------|-----------|
| `/flow-next:prospect` | Gera ideias a partir de uma conversa |
| `/flow-next:plan` | Cria tarefas organizadas |
| `/flow-next:work` | Executa as tarefas |
| `/flow-next:audit` | Revisa o que foi feito |

---

## Como Começar (Passo a Passo)

### Passo 1: Verificar o Sistema

Digite no chat:
```
/saude
```
Isso mostra se todos os sistemas estão funcionando.

### Passo 2: Ver o Mapa de Agentes

Se você quer saber o que os robôs podem fazer:
```
/agentes
```

### Passo 3: Criar um Plano

Quando você tem uma ideia e quer transformá-la em tarefas:
```
/planejar [sua ideia aqui]
```

---

## Skills Disponíveis (Habilidades)

Skills são comandos especiais que você pode usar:

| Skill | O que faz | Quando usar |
|-------|-----------|-------------|
| `/spec` | Cria especificação | Quando precisa documentar requisitos |
| `/plan` | Cria plano de tarefas | Quando precisa organizar o trabalho |
| `/test` | Roda testes | Quando quer verificar se algo funciona |
| `/build` | Constrói código | Quando precisa compilar o projeto |
| `/review` | Revisa código | Quando precisa de feedback |
| `/ship` | Publica mudanças | Quando quer enviar para produção |
| `/debug` | Diagnostica problemas | Quando algo não está funcionando |
| `/sec` | Auditoria de segurança | Quando precisa verificar vulnerabilidades |

---

## Onde encontrar ayuda

| Recurso | Onde | Para quê |
|---------|------|----------|
| Índice de comandos | `.claude/docs-ptbr/INDICE.md` | Ver todos os comandos |
| Guia rápido | `.claude/docs-ptbr/GUIA_RAPIDO.md` | Consulta rápida |
| Flipcards | `.claude/docs-ptbr/VERBO_FLIPCARDS.md` | Aprender comandos |
| Explicação individual | `.claude/docs-ptbr/` | Entender cada comando |

**Nota:** Comandos são em INGLÊS, explicações são em PORTUGUÊS.

---

## Fluxo Padrão de Trabalho

```
┌─────────────────────────────────────────────────────────────┐
│                        VOCÊ TEM UMA IDEIA                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              /flow-next:prospect  (gera ideias)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 /flow-next:plan  (cria tarefas)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             Nexus executa  (49 agentes trabalham)           │
│                    ◄── 15 trabalham juntos ──►              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              /flow-next:audit  (revisam resultado)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      /ship  (publica)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Atalhos Rápidos (Quick Commands)

| Situação | Digite |
|----------|--------|
| "O sistema está bem?" | `status` |
| "O bot está funcionando?" | `saude` |
| "Quero planejar algo" | `planejar` |
| "Quero executar tarefas" | `trabalhar` |
| "Preciso de ajuda" | `ajuda` |

---

## Emergências

| Problema | Ação |
|----------|------|
| Sistema não responde | Digite `saude` |
| Não sei o que fazer | Digite `ajuda` |
| Preciso ver os agentes | Digite `agentes` |
| Estou perdido | Leia este guia novamente |

---

## Dúvidas Frequentes

**P: O que é um "agente"?**
R: É um robô virtual que faz uma tarefa específica. Temos 49 agentes diferentes.

**P: O que é "SPEC"?**
R: Specification — documento que define o que uma tarefa deve fazer.

**P: O que é "smoke test"?**
R: Teste rápido que verifica se o sistema está OK. Como "provar o fumo" — se passar, o sistema está funcionando.

**P: Posso mexer no código?**
R: Sim, mas siga o fluxo: ideia → `/planejar` → executar → revisar.

---

## Pasta de Arquivos Importantes

| Arquivo | Para que serve |
|---------|---------------|
| `AGENTS.md` | Lista todos os agentes e como usá-los |
| `TEAM_GUIDE_pt-BR.md` | Guia detalhado para a equipe |
| `QUICKREF_pt-BR.md` | Referência rápida |
| `docs/NEXUS_GUIDE.md` | Guia do Nexus (executor) |
| `docs/FLOW-NEXT_GUIDE.md` | Guia do Flow-Next (planejador) |

---

## Quem Mantém?

- **Tech Lead:** will
- **Última atualização:** 2026-04-25

---

*Versão 1.0 — Guia simplificado para equipe não-técnica*
