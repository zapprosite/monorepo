# Skill Reference

## Localização das skills

### Skills globais (disponíveis em qualquer projeto)
~/.claude/skills/

### Skills de projeto (disponíveis apenas no projeto atual)
.claude/skills/ (na raiz do repositório)

### Prioridade
Skills de projeto sobrescrevem skills globais de mesmo nome.

## Como acionar uma skill
No Claude Code, use a sintaxe:
/nome-da-pasta-da-skill

Exemplo: /code-reviewer, /security, /create-skill

## Boas práticas de nomenclatura
- Use kebab-case: code-reviewer, not CodeReviewer
- Nomes descritivos do que faz, não do domínio técnico
- Evite nomes genéricos demais (helper, utils, misc)

## Tamanho recomendado
- SKILL.md: máximo 100 linhas
- Arquivos de referência: máximo 200 linhas cada
- Se precisar de mais: divida em múltiplos arquivos temáticos

## Versionamento
- Mantenha skills em git junto com o projeto
- Skills de equipe: commite na raiz do repositório
- Skills pessoais: mantenha em dotfiles pessoais

## Debugging de skills
- Se o Claude não está seguindo a skill: verifique se o SKILL.md está claro o suficiente
- Se a skill carrega mas não ajuda: o Objetivo ou Quando Usar pode estar vago
- Teste a skill com prompts diferentes para verificar consistência
