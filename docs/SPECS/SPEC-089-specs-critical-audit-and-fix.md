---
name: SPEC-089-specs-critical-audit-and-fix
description: "CRITICAL AUDIT FIX: 6 contradictions across 10 specs resolved in one shot. SPEC-073 DISCARDED (Mem0 wins), circuit breaker unified, SPEC-058 fixed, SPEC-072 renamed, SPEC-075 encoding fixed."
status: IN_PROGRESS
priority: critical
author: William Rodrigues / Hermes Audit
date: 2026-04-20
---

# SPEC-089: SPECs Critical Audit & One-Shot Fix

## Contexto

Audi**tória crítica identificou 6 contradições graves em 10 especificações. Este documento contém o plano de ação e o prompt para executar todas as correções em um shot.**

---

## PROMPT PARA CLAUDE CODE

Copie e cole o seguinte no Claude Code:

```
Execute /spec com o seguinte título e descrição:

"SPEC-089: Corrigir contradições críticas nas SPECs do monorepo"

Descrição completa:

## PROBLEMA

A auditoria crítica identificou 6 contradições graves que precisam de correção imediata:

### 1. CONFLITO DIRETO: SPEC-073 vs SPEC-074 (Second Brain)
- SPEC-073: Custom implementation WITHOUT Mem0
- SPEC-074: Mem0-based implementation (53k stars, 2-3 days effort)
- DECISÃO: Manter SPEC-074 (Mem0 wins). SPEC-073 deve ser DESCARTADO.

### 2. DUPLICATE: Circuit Breaker em dois lugares
- SPEC-060 HC-36: `agency_router.ts:162-165`
- SPEC-068: `skills/circuit_breaker.ts`
- DECISÃO: Manter SPEC-068 como canónico (skills/circuit_breaker.ts mais limpo). SPEC-060 HC-36 deve ser REMOVIDO de agency_router.ts e o código migrado para usar o módulo de SPEC-068.

### 3. SPEC-058: Status mente (IMPLEMENTED vs PROPOSED)
- Header diz IMPLEMENTED mas 8 sub-specs dizem PROPOSED
- LLM chain diagrama ainda mostra `ollama/llama3-portuguese-tomcat-8b` como fallback de texto — PROIBIDO desde SPEC-053
- DECISÃO: Atualizar status para IN_PROGRESS + corrigir LLM chain para refletir MiniMax-M2.7 como primário e Ollama apenas para Vision/STT.

### 4. SPEC-072: Título não corresponde ao conteúdo
- Título diz "XTTS-v2" mas Coqui deprecated → spec recomenda F5-TTS
- DECISÃO: Renomear para "SPEC-072: TTS PT-BR Upgrade — F5-TTS Voice Cloning"

### 5. SPEC-075: Encoding bug com caracteres chineses
- Caracteres "明清" aparecem no meio do documento em PT-BR
- DECISÃO: Remover caracteres corrompidos e fixar encoding do arquivo.

### 6. SPEC-064: Verificar deleção real
- SPEC-064 diz que deletou SPEC-034, SPEC-048, SPEC-061, SPEC-062
- DECISÃO: Verificar se esses arquivos ainda existem em /srv/monorepo/docs/SPECS/ e deletar se presentes.

---

## EXECUÇÃO

### Arquivos para MODIFICAR:

1. `/srv/monorepo/docs/SPECS/SPEC-058-hermes-agency-suite.md`
   - Mudar `status: IMPLEMENTED` para `status: IN_PROGRESS`
   - Atualizar LLM chain (seção ~linha 204-218) removendo `ollama/llama3-portuguese-tomcat-8b` do fallback texto
   - Adicionar nota: "Fallback texto REMOVIDO — texto vai SEMPRE via MiniMax (SPEC-053)"

2. `/srv/monorepo/docs/SPECS/SPEC-072-tts-ptbr-gpu24gb-upgrade.md`
   - Mudar nome no header para "SPEC-072: TTS PT-BR Upgrade — F5-TTS Voice Cloning"
   - Na descrição: "XTTS-v2 depreciado → F5-TTS como recomendado (SPEC-076)"

3. `/srv/monorepo/docs/SPECS/SPEC-075-jarvis-prompt-retorno.md`
   - Remover caracteres "明清" e qualquer outro character estranho
   - Garantir que o arquivo está em UTF-8 limpo

4. `/srv/monorepo/docs/SPECS/SPEC-060-hermes-agency-post-hardening-improvements.md`
   - Na seção HC-36: marcar como "MIGRADO → SPEC-068"
   - Remover menção de circuit breaker do agency_router.ts (vai ser feito pelo código)

5. `/srv/monorepo/docs/SPECS/SPEC-068-langgraph-circuit-breaker.md`
   - Atualizar status para "CANÓNICO" (única implementação de circuit breaker)
   - Adicionar nota: "Substitui HC-36 de SPEC-060"

6. `/srv/monorepo/docs/SPECS/SPEC-073-agente-bibliotecario.md`
   - Mudar status para "DISCARDED — Mem0 approach chosen (SPEC-074)"
   - Na descrição: "ABANDONADO — William escolheu Mem0 (SPEC-074) em vez de custom"

### Arquivos para DELETAR:

7. `/srv/monorepo/docs/SPECS/SPEC-034-*.md` (se existir)
8. `/srv/monorepo/docs/SPECS/SPEC-048-*.md` (se existir)
9. `/srv/monorepo/docs/SPECS/SPEC-061-*.md` (se existir)
10. `/srv/monorepo/docs/SPECS/SPEC-062-*.md` (se existir)

### Código para MODIFICAR:

11. `apps/hermes-agency/src/agency_router.ts`
    - Remover implementação de circuit breaker HC-36 (linhas ~162-165)
    - Importar e usar `skills/circuit_breaker.ts` de SPEC-068
    - Garantir que o circuit breaker é um único módulo importado

---

## VERIFICAÇÃO

Depois de fazer as alterações, executar:

```bash
# Verificar que SPEC-073 foi marcado como DISCARDED
grep -i "DISCARDED\|ABANDONED" /srv/monorepo/docs/SPECS/SPEC-073-agente-bibliotecario.md

# Verificar que SPEC-072 tem F5-TTS no nome
grep -i "F5-TTS" /srv/monorepo/docs/SPECS/SPEC-072-tts-ptbr-gpu24gb-upgrade.md

# Verificar que SPEC-058 não tem mais Ollama como fallback de texto
grep -i "llama3-portuguese-tomcat" /srv/monorepo/docs/SPECS/SPEC-058-hermes-agency-suite.md
# Esperado: 0 resultados

# Verificar que não há caracteres chineses em SPEC-075
grep -P "[\x{4e00}-\x{9fff}]" /srv/monorepo/docs/SPECS/SPEC-075-jarvis-prompt-retorno.md
# Esperado: nenhum resultado

# Verificar specs antigas deletadas
ls /srv/monorepo/docs/SPECS/SPEC-034* 2>/dev/null && echo "AINDA EXISTE" || echo "OK"
ls /srv/monorepo/docs/SPECS/SPEC-048* 2>/dev/null && echo "AINDA EXISTE" || echo "OK"
ls /srv/monorepo/docs/SPECS/SPEC-061* 2>/dev/null && echo "AINDA EXISTE" || echo "OK"
ls /srv/monorepo/docs/SPECS/SPEC-062* 2>/dev/null && echo "AINDA EXISTE" || echo "OK"
```

---

## SUCESSO

- [ ] SPEC-073 marcado como DISCARDED
- [ ] SPEC-072 renomeado para F5-TTS
- [ ] SPEC-058 com status correto e LLM chain atualizado
- [ ] SPEC-075 sem caracteres chineses
- [ ] SPECs 034/048/061/062 deletadas (se existiam)
- [ ] Circuit breaker unificado em skills/circuit_breaker.ts (SPEC-068)
- [ ] agency_router.ts usa circuito breaker do módulo importado
- [ ] /ship executado para commitar todas as mudanças
```

---

## RESULTADO ESPERADO

Após execução do prompt acima:
- SPEC-073 (custom) descartada, SPEC-074 (Mem0) mantida
- Circuit breaker em um lugar só (SPEC-068)
- SPEC-058 com status e arquitetura corrigidos
- SPEC-072 com nome correto
- SPEC-075 com encoding limpo
- SPECs obsoletas deletadas
- Código unificado

---

## REFERÊNCIA

Audit completo em: SPEC-053 a SPEC-088 (20 arquivos, ~5544 linhas)
