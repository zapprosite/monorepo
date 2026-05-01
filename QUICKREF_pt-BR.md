# REFERÊNCIA RÁPIDA — SLASH COMMANDS

## Documentação em PT-BR

Para explicaciones detalhadas em português, veja:
- `.claude/docs-ptbr/INDICE.md` — índice completo
- `.claude/docs-ptbr/GUIA_RAPIDO.md` — guia de referência
- `.claude/docs-ptbr/VERBO_FLIPCARDS.md` — flashcards

Os comandos permanecem em INGLÊS, a explicação é em PT-BR.

**Data:** 2026-04-25 | **Versão:** 2.0

---

## PLANEJAMENTO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/plan` | Precisa criar um plano de implementação | Cria lista de tarefas estruturadas |
| `/spec` | Vai começar feature ou projeto novo | Gera SPEC.md a partir de requisitos |
| `/feature-breakdown` | Tem uma feature grande para dividir | Quebra em tarefas implementáveis |

---

## EXECUÇÃO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/build` | Implementar próxima tarefa incrementalmente | Constrói, testa, verifica e commita |
| `/execute` | SPEC completa → paralelização com 14 agentes | Workflow completo SPEC → PR |
| `/test` | Quer seguir fluxo TDD | Escreve testes, implementa, verifica |
| `/autopilot` | Execução autônoma até task verificada | Opera até conclusão completa |

---

## REVISÃO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/code-review` | Revisar código antes de merge | Análise de qualidade e padrões |
| `/review` | Revisar pull request | Verifica padrões da equipe |
| `/security-review` | Audit de segurança do diff atual | Checklist de vulnerabilidades |
| `/refactoring` | Precisa refatorar código | Refatoração segura e incremental |

---

## DEPURAÇÃO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/universal-debug` | Bug ou erro inesperado | 4 fases: Reproduzir, Isolar, Entender, Corrigir |
| `/bug-investigation` | Investigar bug sistematicamente | Análise de causa raiz |

---

## DOCUMENTAÇÃO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/documentation` | Gerar ou atualizar docs técnicas | Cria e mantém documentação |
| `/brainstorming` | Trabalho criativo ou feature nova | Explora intent, requisitos e design |

---

## SHIP & RELEASE

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/ship` | Final de sessão — sync completo | Docs → memory, commit, push, merge, nova branch |
| `/turbo` | Ship rápido sem PR | Commit → push → merge → tag → nova branch |
| `/universal-turbo` | Modo turbo universal (qualquer VCS) | Commit, merge, tag e nova branch em fluxo seguro |

---

## ARQUITETURA & DESIGN

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/api-design` | Desenhar API RESTful | Segue melhores práticas de API |
| `/infra-from-spec` | Gerar infraestrutura do zero | Docker Compose, Terraform, Prometheus |

---

## GIT & VERSIONAMENTO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/commit` | Fazer commit das alterações | Cria commit com mensagem convencional |
| `/universal-ship` | End-of-session pattern completo | Sincroniza docs, memory, commit, push em ambos remotos |

---

## UTILITÁRIOS

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/sec` | Audit de secrets/segredos | Verifica credenciais vazadas |
| `/img` | Analisar imagem (URL, arquivo, print) | Qwen2.5-VL-3B via Ollama ou LiteLLM |
| `/init` | Inicializar CLAUDE.md novo | Cria arquivo com documentação do codebase |
| `/simplify` | Limpar código para clareza | Reduz complexidade sem mudar comportamento |
| `/test-generation` | Gerar casos de teste | Cria testes abrangentes para código |

---

## AUTOMAÇÃO & MONITORAMENTO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/loop` | Tarefa recorrente ou polling | Executa prompt em intervalo (default 10m) |
| `/cursor-loop` | CI/CD autônoma com cursor | Plan → build → test → review → ship até completion |
| `/gitea-cli` | Gerenciar repos, workflows, PRs | CLI para Gitea API |

---

## CONFIGURAÇÃO

| Comando | Quando Usar | O que faz |
|---------|-------------|-----------|
| `/config` | Alterar configurações do Claude Code | Muda tema, modelo, preferências |
| `/claude-api` | Trabalhar com SDK Claude API | Build, debug, otimiza apps com Anthropic SDK |
| `/keybindings-help` | Personalizar atalhos de teclado | Adiciona/redefine keybindings |

---

## WORKFLOWS COMPLETOS

| Workflow | Faz |
|----------|-----|
| **Spec-Driven** | `/spec` → `/plan` → `/build` → `/test` → `/review` → `/ship` |
| **Execute Full** | `/execute` (SPEC → 14 agentes → PR) |
| **Turbo Ship** | `/turbo` (commit → push → merge → tag → nova branch) |
| **Universal Debug** | `/universal-debug` (Reproduce → Isolate → Understand → Fix) |
| **TDD** | `/test` (write failing tests → implement → verify) |

---

*Versão 2.0 — 2026-04-25*
