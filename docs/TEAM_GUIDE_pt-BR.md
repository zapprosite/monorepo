# Monorepo — Guia da Equipe

**Projeto:** homelab.zappro.site
**Atualizado:** 2026-04-25

---

## 1. O que é este projeto?

Este é o **monorepo** do homelab — onde todo o código do projeto vive junto.

| Pasta | Conteúdo |
|------|----------|
| `apps/` | Aplicações (API, frontend) |
| `docs/` | Documentação e especificações |
| `scripts/` | Automação (sync, backup, health-check) |
| `smoke-tests/` | Testes rápidos de sanidade |
| `.claude/` | Atalhos e habilidades do Claude Code |

---

## 2. Sistemas Principais

### Hermes (Bot de IA)
- Responde mensagens e gerencia agentes
- Verificar: `bash smoke-tests/smoke-hermes-ready.sh`

### Nexus (Executor de Tarefas)
- Executa tarefas com 49 agentes especializados
- `bash .claude/vibe-kit/nexus.sh --status` — estado atual
- `bash .claude/vibe-kit/nexus.sh --mode list` — lista de agentes

### Flow-Next (Planejador)
- Planeja e organiza tarefas antes de executar
- `/flow-next:plan` — planeja próximo passo
- `/flow-next:work` — executa tarefas
- `/flow-next:audit` — revisa resultado

---

## 3. Como Começar

```
Ideia → /flow-next:prospect → /flow-next:plan → Nexus executa → /flow-next:audit
```

**Passo a passo:**
1. Tenha uma ideia ou tarefa
2. Use `/flow-next:plan` para criar um plano
3. Nexus executa com 49 agentes
4. Use `/flow-next:audit` para revisar

**Comandos úteis:**

| Quer... | Use |
|---------|-----|
| Estado do sistema | `status` |
| Saúde do bot | `saude` |
| Planejar algo | `planejar` |
| Executar tarefas | `trabalhar` |

---

## 4. Skills de Referência

| Skill | Quando usar |
|-------|-------------|
| `/plan` | Planejamento de implementação |
| `/spec` | Criar especificação antes de codar |
| `/test` | TDD — escrever testes primeiro |
| `/build` | Implementar incrementalmente |
| `/review` | Revisar código antes de merge |
| `/ship` | Finalizar e sincronizar |
| `/debug` | Problemas e erros |
| `/sec` | Auditoria de segurança |

## Documentacao PT-BR

A equipe pode consultar explicacoes em portugues dos comandos em:
- `.claude/docs-ptbr/` — pasta com docs detalhadas

Os comandos do Claude Code sao em ingles, mas a equipe entende em PT-BR.

---

*Atualizado: 2026-04-25*