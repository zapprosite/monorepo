# Codex Comandos

Guia curto para usar o Codex CLI neste monorepo sem decorar Nexus, GSD ou caminhos internos.

## Uso para dev júnior

No terminal, dentro de `/srv/monorepo`:

```bash
./codex-comandos/codex iniciar
```

Copie o texto que aparecer e cole numa janela nova do Codex CLI.

## Comandos principais

```bash
./codex-comandos/codex iniciar
./codex-comandos/codex status
./codex-comandos/codex proximo
./codex-comandos/codex fase 3
./codex-comandos/codex ship
```

## Quando usar

| Comando | Uso |
|---|---|
| `iniciar` | Começar uma sessão vazia do Codex |
| `status` | Ver estado GSD/Nexus/git sem alterar nada |
| `proximo` | Pedir para executar o próximo plano incompleto |
| `fase N` | Pedir para executar uma fase específica |
| `ship` | Validar, commitar, pushar e abrir PR |

## Regra

O script não executa mudanças sozinho. Ele imprime o prompt correto para colar no Codex.

Assim o dev júnior trabalha com um comando simples e o Codex continua decidindo com contexto completo.

## Skills disponíveis

Use estes nomes nos prompts quando precisar:

| Skill | Quando pedir |
|---|---|
| `nexus-router` | Classificar tarefa, decidir local/cloud, usar `nexus classify/run` |
| `gsd-global` | Trabalhar com `.planning`, fases, planos, `/gsd-autonomous`, status |
| `gorila-mode` | Respostas curtas, foco, contrato do homelab |
| `homelab-context` | Qualquer coisa em `/srv`, portas, containers, gateways, contexto local |
| `openai-docs` | Dúvidas sobre OpenAI/API/modelos atuais |
| `skill-creator` | Criar uma skill nova para o Codex |
| `skill-installer` | Instalar skill já existente |
| `plugin-creator` | Criar plugin local |
| `imagegen` | Gerar/editar imagem raster |

## Como adicionar novo comando

Peça dentro do Codex, no repo `/srv/monorepo`:

```text
Use gorila-mode e homelab-context.
Adicione um novo comando em codex-comandos/codex chamado NOME.
Ele deve imprimir um prompt em PT-BR para OBJETIVO.
Atualize codex-comandos/README.md com uso, quando usar e skills recomendadas.
Não execute ações reais no comando; só imprima o prompt.
Rode ./codex-comandos/codex ajuda e teste o novo comando.
Faça commit docs/chore atômico.
```

Exemplo:

```text
Use gorila-mode e homelab-context.
Adicione um comando em codex-comandos/codex chamado revisar.
Ele deve imprimir um prompt para o Codex fazer code review da branch atual,
usando nexus-router para classificar riscos e gsd-global se houver .planning.
Atualize o README e teste.
```

## Padrão de um comando novo

Todo comando deve:

1. Falar em PT-BR.
2. Dizer quais skills usar.
3. Dizer se pode editar arquivos ou só analisar.
4. Dizer quais validações rodar.
5. Proibir exposição de secrets.
6. Evitar merge em `main`.

Modelo de prompt:

```text
Use as skills SKILL_1, SKILL_2.

Objetivo: ...

Regras:
- ...

Validação:
- ...

No final, responda com:
- arquivos alterados
- testes rodados
- commit criado, se houver
```
