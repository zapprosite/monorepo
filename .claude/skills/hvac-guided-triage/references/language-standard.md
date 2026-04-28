# Padrão de Idiomas — PT-BR como Default

## Regra Global

**PT-BR é o idioma padrão** para toda documentação, respostas ao utilizador e regras do projeto. EN é usado apenas para código técnico, comments e mensagens de commit.

## Tabela de Aplicação

| Tipo | Idioma | Exemplo |
|------|--------|---------|
| Respostas ao utilizador | **PT-BR** | "O container está healthy" |
| Documentação (.md) | **PT-BR** | "Este documento descreve..." |
| Regras (.rules) | **PT-BR** | "nunca exponha valores de API keys" |
| Código fonte | EN (technical) | `const userId = getUserId()` |
| Comments no código | EN (technical) | `// Initialize connection pool` |
| Commits | EN | `feat: add user authentication` |
| Specs / ADRs | **PT-BR** | "Especificação do sistema de autenticação" |
| Erros / Logs | EN (technical) | `Error: connection timeout` |

## Para a Skill hvac-guided-triage

- `SKILL.md` — PT-BR ✅
- `references/*.md` — PT-BR ✅
- `scripts/*.sh` — comments em EN técnico, output em PT-BR
- `evals/*.jsonl` — dados em EN (queries e Expected fields)

## Proibição de Caracteres Chineses

**REGRA:** Nenhum caractere chino (U+4E00-U+9FFF, ranges: `一-鿿㐀-䶿𠀀-𯟿`) é permitido em código, documentação ou comentários do projeto.

**Porquê:** Mantém o código acessível a todos os membros do time, evita erros de encoding e segue a regra global PT-BR como default.

**Exceções documentadas (apenas estas):**
- `vrv系統` — sistema VRV (chinês tradicional)
- `vrf系統` — sistema VRF (chinês tradicional)
- `vrv系统` — sistema VRV (chinês simplificado)

Estas exceções existem porque aparecem em documentação técnicaoriginal de equipamentos HVAC. Qualquer outra ocorrência deve ser removida.

**Verificação:**
```bash
bash .claude/skills/hvac-guided-triage/scripts/scan-chinese.sh
```

**Scan automático (cron):** Ver `scan-chinese-cron.sh` — roda diariamente às 03:00 e envia relatório por email em caso de falhas.

## Exemplo de Response em PT-BR

```
Entendi: E4 em VRV Daikin. Em VRV, E4 geralmente aponta
para baixa pressão. Confirma se aparece E4-01/E4-001,
E4-02 ou E4-03?
```

## Anti-Pattern de Idioma

```typescript
// ❌ ERRADO — mistura de PT-BR em código
const idDoUsuario = getUserId();

// ✅ CORRETO — EN em código, PT-BR apenas em comments explicativos
const userId = getUserId(); // ID do usuário logado
```
