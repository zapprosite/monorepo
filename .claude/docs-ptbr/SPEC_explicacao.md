# /spec — Especificação

## O que é
O comando `/spec` gera uma SPEC.md formal a partir de requisitos em português ou inglês.

## Quando usar
- Antes de começar qualquer feature nova
- Quando os requisitos estão vagos
- Quando precisa documentar antes de implementar

## O que acontece
1. Extrai problema e contexto da conversa
2. Identifica acceptance criteria
3. Determina tech stack se aplicável
4. Gera SPEC.md com frontmatter (name, description, status, owner, created)
5. Salva em /srv/monorepo/docs/SPECS/SPEC-NNN.md

## Fluxo
```
/spec → você descreve ideia → sistema gera SPEC → você revisa → /plan
```

## Não é
- Não implementa
- Não cria código
- Não faz testes
