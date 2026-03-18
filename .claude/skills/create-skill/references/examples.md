# Exemplos de Skills

## Exemplo 1: skill simples com apenas SKILL.md

```
code-reviewer/
└── SKILL.md
```

SKILL.md:
```
# Code Reviewer

## Objetivo
Revisar código com foco em clareza, performance e segurança.

## Como executar
1. Leia o código fornecido
2. Identifique problemas em 3 categorias: bugs, performance, segurança
3. Para cada problema: explique o issue, mostre o código ruim e o corrigido
4. Finalize com um score de 1 a 10 e 3 sugestões prioritárias

## Output esperado
Revisão estruturada com seções por categoria, exemplos de antes/depois e score final.
```

## Exemplo 2: skill com múltiplos arquivos de referência

```
api-builder/
├── SKILL.md
├── patterns.md
├── error-handling.md
└── auth-patterns.md
```

SKILL.md referencia os outros arquivos:
```
## Como executar
1. Leia patterns.md para estrutura base
2. Leia error-handling.md para tratamento de erros
3. Se rota protegida: leia auth-patterns.md
```

## Exemplo 3: skill com contexto de projeto específico

```
ggcheckout-backend/
├── SKILL.md
├── architecture.md
├── conventions.md
└── integrations.md
```

Contexto específico do projeto: stack, naming conventions, integrações ativas, regras de negócio.

## O que torna uma skill boa
- Trigger claro: quando usar é óbvio
- Processo definido: passo a passo sem ambiguidade
- Output previsível: sempre entrega no mesmo formato
- Concisa: menos de 1 página por arquivo sempre que possível
