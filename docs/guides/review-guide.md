---
name: Code Review Guide
description: Guia para reviewers validarem implementação antes de reportar status
type: guide
---

# Code Review Guide

## Regra de Ouro

**NUNCA reporte "MISSING" sem primeiro verificar com grep ou Read.**

---

## Checklist de Verificação

### Antes de Reportar "MISSING"

1. **grep no filesystem** —Busca o símbolo/nome antes de concluir que não existe:
   ```bash
   grep -r "NomeProcurado" --include="*.go"
   ```

2. **Read direto** — Se grep encontrou, leia o arquivo na linha exata.

3. **Confirme existencia** — Só reporte "MISSING" se grep NÃO encontrou nada.

### Para Tasks de Implementação

| Item a Verificar | Como Verificar |
|------------------|----------------|
| Struct existe | `grep "type X struct" *.go` |
| Method existe | `grep "func.*X(" *.go` |
| Field existe | `grep "FieldName" *.go` |
| Arquivo existe | `ls -la path/to/file.go` |

### Para Review de Agentes (Background)

1. **Verificar implementação real**, não apenas.pipeline.json
2. **确认 (确认)** — confirmar duas vezes antes de reportar status
3. **Report completo** — listar O QUE foi encontrado, não apenas "OK" ou "MISSING"

---

## Template de Report

```
## [Task XX] Review

### Verificações Realizadas
- [ ] grep "SymbolName" → ENCONTRADO em `path/file.go:line`
- [ ] Struct `Name` existe → L23
- [ ] Method `Name()` existe → L45

### Resultado
**OK** ou **ISSUES FOUND**

### Se Issues Found
| Item | Expected | Actual |
|------|----------|--------|
| ... | ... | ... |
```

---

## Armadilhas Comuns

❌ **Não fazer**:
- Reportar "MISSING" baseado em intuição
- Não verificar grep antes de concluir
- Confiar apenas em pipeline.json

✅ **Fazer**:
- grep primeiro, sempre
- Read para confirmar
- Reportar linha exata onde está o código