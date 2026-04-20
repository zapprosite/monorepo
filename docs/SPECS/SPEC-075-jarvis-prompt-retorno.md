# SPEC-075 — Jarvis Prompt de Retorno

**Data:** 2026-04-18
**Autor:** William Rodrigues
**Status:** Draft
**Review:** Claude Code CLI

---

## 1. Resumo

Prompt de retorno que o Jarvis (Hermes Agent) usa depois de navegar o Ubuntu, consultar planilhas de obra, ou buscar informações da Refrimix. É o "relatório" que o agent devolve pro William — formatado, acionável, sem ruído.

---

## 2. O problema

Hoje o Hermes retorna tudo que encontra, sem filtro. Quando Jarvis navega 5 pastas de obra e encontra 12 arquivos, o retorno é cru — lista de paths, timestamps, tamanhos. O usuário tem que processar.

**O prompt de retorno** é a camada de filtro e formatação que transforma "dados brutos" em "informação útil".

---

## 3. O que o prompt de retorno faz

```
[RAW DATA do Jarvis]
       ↓
  PROMPT RETORNO
  "Analise estes dados e retorne em formato estruturado:"
       ↓
[RETORNO FORMATADO]
  ├── Status: ✅ / ⚠️ / 🔴
  ├── Resumo: 1-2 frases
  ├── Findings: bullet points
  ├── Próximo passo: ação recomendada
  └── Urgência: alta / média / baixa
```

---

## 4. Template do Prompt de Retorno

```
## Contexto
Você é o Jarvis, assistente de operações da Refrimix Tecnologia.
Você acabou de executar uma tarefa de busca/navegação no sistema do William.

## Dados brutos
<DADOS_BRUTOS>

## Sua tarefa
Transforme os dados brutos acima em um relatório estruturado.

## Formato obrigatório (responda APENAS neste formato):

### [STATUS]
✅ Sucesso | ⚠️ Atenção necessária | 🔴 Problema encontrado

### [RESUMO]
1-2 frases explicando o que foi encontrado.

### [FINDINGS]
- <finding 1>
- <finding 2>
- ...

### [PRÓXIMO PASSO]
<uma única ação recomendada, se houver>

### [URGÊNCIA]
alta | média | baixa

### [AÇÃO REQUERIDA]
Sim / Não — se Sim, qual?

## Regras
- Não invente dados. Se a informação não está nos dados brutos, diga "Informação não disponível"
- Use emoji apenas nos headers ([STATUS])
- Seja conciso — máximo 5 findings
- Se não houver próximo passo, escreva "Nenhum — tudo em ordem"
```

---

## 5. Exemplos de Retorno

### Exemplo 1: Busca de obras

```
### [STATUS]
✅ Sucesso

### [RESUMO]
Encontradas 3 obras ativas e 2 orçamentos pendentes.

### [FINDINGS]
- Obra #001 — Cliente: Restaurante Central. Status: em andamento (85%). Previsão: 20/04.
- Obra #002 — Cliente: Clínica Oeste. Status: em andamento (40%). Previsão: 15/05.
- Obra #003 — Cliente: Escola Norte. Status: aguardando material. Início: 22/04.
- Orçamento #OR-023 — Cliente: Hotel Sul. Valor: R$ 48.500. Aguardando aprovação.
- Orçamento #OR-024 — Cliente: Escritório Leste. Valor: R$ 22.000. Aguardando aprovação.

### [PRÓXIMO PASSO]
Aprovar orçamento #OR-023 (prioridade alta — cliente esperando desde 14/04).

### [URGÊNCIA]
alta

### [AÇÃO REQUERIDA]
Sim — CLIQUE AQUI para aprovar #OR-023 via Telegram
```

### Exemplo 2: Verificação de memory

```
### [STATUS]
✅ Sucesso

### [RESUMO]
Collection "will" no Qdrant contém 847 memórias. E5-mistral OK.

### [FINDINGS]
- Total de memórias: 847
- Memórias esta semana: 23
- Coleção: will (1024-dim, coseno)
- Embedding model: e5-mistral via Ollama (:11434)
- Última memória salva: "KPI Abril — MRR 52k" (2026-04-18 09:14)

### [PRÓXIMO PASSO]
Nenhum — tudo em ordem

### [URGÊNCIA]
baixa

### [AÇÃO REQUERIDA]
Não
```

### Exemplo 3: Problema detectado

```
### [STATUS]
🔴 Problema encontrado

### [RESUMO]
Qdrant está respondendo com latência alta (>2s) — possível problema de memória.

### [FINDINGS]
- Latência média: 2.340ms (normal: <100ms)
- Memórias pendentes de indexação: 0
- Uso de disco Qdrant: 89% (3.8GB/4.3GB)
- Última vez que latência esteve assim: 2026-03-22 (snapshots acumulado)

### [PRÓXIMO PASSO]
Limpar snapshots antigos do Qdrant ou expandir disco.

### [URGÊNCIA]
alta

### [AÇÃO REQUERIDA]
Sim — Executar cleanup de snapshots? (Roda em 30s, sem downtime)
```

---

## 6. Quando o prompt de retorno é usado

```
╔════════════════════════════════════════════════════╗
║  JARVIS TASK COMPLETED                              ║
║                                                     ║
║  1. Jarvis executa tarefa                          ║
║  2. Dados brutos coletados                         ║
║  3. PROMPT RETORNO injetado                        ║
║  4. LLM formata resposta                            ║
║  5. Retorno enviado pro usuário (Telegram/CLI)     ║
╚════════════════════════════════════════════════════╝
```

**Trigger:** Toda vez que Jarvis completa uma operação de busca, navegação, ou verificação.

---

## 7. Integração com Hermes

```python
# hermes/tools/librarian/return_prompt.py

RETURN_PROMPT_TEMPLATE = """
## Contexto
Você é o Jarvis, assistente de operações da Refrimix Tecnologia.
...

## Dados brutos
{raw_data}

## Formato obrigatório (responda APENAS neste formato):
...
"""

def format_return(raw_data: str, task_type: str) -> str:
    prompt = RETURN_PROMPT_TEMPLATE.format(raw_data=raw_data)
    # Chamar LLM (Hermes) para formatar
    response = hermes.chat(prompt)
    return response
```

---

## 8. Variações por tipo de tarefa

| Tarefa | Variação no prompt |
|--------|-------------------|
| Busca de obras | Inclui status + valor + prazo |
| Verificação de DB | Inclui counts + health |
| Busca de memória | Inclui relevance score |
| Análise de arquivo | Inclui summary + ação sugerida |
| Cron job diário | Include delta vs ontem |

---

## 9. Out of Scope

-[REMOVIDO-CJK]  CLI visual (Rich tables no terminal — fica pro v2)
- Dashboard web
- Notificação push (Telegram já cobre)
