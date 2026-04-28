# HVAC Guided Triage — Exemplos Antes/Depois

## Problema Observado

Query: "erro e4 vrv daikin"

### ANTES (comportamento antigo)
- Juiz retornava: ASK_CLARIFICATION
- Mensagem: "Para ajudar melhor, preciso do modelo completo da unidade."
- Resultado: Usuário leigo ficava perdido, tinha que fornecer modelo completo antes de qualquer ajuda

### DEPOIS (comportamento novo com guided_triage)
- Juiz retornava: GUIDED_TRIAGE
- Mensagem: "Você encontrou o código E4 no sistema VRV da Daikin. E4 é uma família de erros que geralmente aponta para baixa pressão no circuito. Qual é o subcódigo que aparece no display? (ex: E4-01, E4-001)"
- Resultado: Usuário recebe ajuda imediata com pista segura

---

## Exemplos Detalhados

### 1. "erro e4 vrv daikin"

**ANTES:**
```
Juiz: ASK_CLARIFICATION
Mensagem: "Para ajudar melhor, preciso do modelo completo da unidade.
Exemplo: RXYQ20BRA + FXYC20BRA (unidade externa + interna)."
```

**DEPOIS:**
```
Juiz: GUIDED_TRIAGE
Mensagem: "Você encontrou o código E4 no sistema VRV/VRF da Daikin.

O que significa E4 em Daikin VRV:
E4 é uma *família* de erros que geralmente aponta para **baixa pressão** no circuito.

Os subcódigos mais comuns são:
- E4-01 / E4-001 → Provável baixa pressão na unidade Master
- E4-02 / E4-002 → Variação por unidade interna/slave
- E4-03 / E4-003 → Outra variação slave

Próximo passo: Confirme o subcódigo no display da unidade externa."
```

---

### 2. "e4-01 daikin vrv"

**ANTES:**
```
Juiz: ASK_CLARIFICATION
Mensagem: "Para ajudar melhor, preciso do modelo completo."
(Mesmo tendo subcódigo, ainda pedia modelo completo)
```

**DEPOIS:**
```
Juiz: GUIDED_TRIAGE
Mensagem: "Você mencionou E4-01 no sistema VRV da Daikin.

E4-01 em VRV Daikin geralmente indica **baixa pressão na unidade Master** (principal).

Para confirmar o diagnóstico:
1. Verifique se há vazamento visível na tubulação
2. Confirme se a pressão de baixa está anormal (manômetro)
3. Verifique o display da unidade Master para outros códigos

⚠️ AVISO: Não faça medições energizadas sem respaldo do manual."
```

---

### 3. "erro e4 split daikin"

**ANTES:**
```
(Tratava igual a VRV, dava informação potencialmente errada)
```

**DEPOIS:**
```
Juiz: GUIDED_TRIAGE
Mensagem: "Você mencionou código E4 em um equipamento Daikin.

⚠️ Importante: E4 em Split/Hi-Wall pode ter significado diferente de VRV/VRF.

- Em VRV/VRF: E4 = baixa pressão
- Em Split Hi-Wall: pode ter tabela de códigos diferente

Confirme primeiro: Qual é a família do equipamento?
- Se for VRV/VRF: consulte a tabela VRV
- Se for Split/Hi-Wall: precisamos consultar a tabela específica

Qual é o modelo ou família do equipamento? (ex: Hi-Wall, Cassete, Piso-teto)"
```

---

## Anti-Patterns (O que NÃO fazer)

### ❌ "Compressor Protection Trip"
Este é um anti-pattern para E4 VRV Daikin. E4 NÃO é compressor protection trip.

### ❌ Valores exatos inventados
```
"Nível de pressão está em 150 PSI" ❌ (inventado)
"O valor deve estar entre 100-200 PSI" ❌ (inventado)
```

### ❌ Pedir tudo de uma vez
```
"Forneça: modelo externo, modelo interno, subcódigo, serial, foto da placa" ❌
```

## Critérios de Aceite

| Query | Critério |
|-------|----------|
| "erro e4 vrv daikin" | Não pede modelo completo primeiro |
| "e4-01 daikin vrv" | Menciona baixa pressão Master |
| "e4-001 vrv 4 daikin" | Trata como equivalente de E4-01 |
| "erro e4 split daikin" | Aviso de diferença VRV/Split |
| "e4 high wall daikin" | Não usa tabela VRV |

## Status: `guided_triage_ready=true`
