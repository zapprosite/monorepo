# OpenWebUI HVAC Strict Only

**Status:** vigente desde 2026-05-05  
**Escopo:** `openwebui-hvac`, `hvac-rag.service`, `chat.zappro.site`  
**Modelo único permitido:** `hvac-manual-strict`

## Regra

OpenWebUI é exclusivo para o projeto HVAC RAG. Ele deve expor exatamente um modelo:

```text
hvac-manual-strict
```

É proibido recriar aliases, perfis públicos, funções ou modelos auxiliares no OpenWebUI. Modos de resposta, se existirem, devem ser internos ao pipeline `hvac-manual-strict` e não aparecer no seletor de modelo.

## Proibido

- Adicionar modelos públicos além de `hvac-manual-strict`
- Recriar aliases legados de tutor, printable ou nomes comerciais antigos
- Manter arquivos `.bak`, specs mortas ou perfis YAML com identificadores legados
- Criar funções globais no OpenWebUI para contornar o pipeline HVAC
- Apontar OpenWebUI diretamente para LiteLLM/Ollama quando o destino deveria ser o pipeline HVAC

## Estado Esperado

```bash
curl -fsS http://127.0.0.1:4017/pipelines
```

Deve retornar lista com um item:

```json
[{"id":"hvac-manual-strict","name":"HVAC Manual Strict","version":"1.0.0","type":"filter"}]
```

No SQLite do OpenWebUI:

- `model`: somente `hvac-manual-strict`
- `function`: `0` linhas
- `config.openai.api_configs.0.model_ids`: `["hvac-manual-strict"]`
- `config.openai.api_configs.0.pipeline.pipelines`: `["hvac-manual-strict"]`

## Comandos de Verificação

```bash
docker exec openwebui-hvac sh -lc 'python - <<PY
import sqlite3, json
con = sqlite3.connect("/app/backend/data/webui.db")
print([r for r in con.execute("select id,name,is_active from model order by id")])
data = json.loads(con.execute("select data from config where id=1").fetchone()[0])
print(data["openai"]["api_configs"]["0"]["model_ids"])
print(data["openai"]["api_configs"]["0"]["pipeline"]["pipelines"])
print(con.execute("select count(*) from function").fetchone()[0])
PY'
```

## Recuperação

Se outro agente recriar legado:

1. Remova o modelo/alias do SQLite do OpenWebUI.
2. Remova funções globais da tabela `function`.
3. Corrija `DEFAULT_MODELS`, `DEFAULT_PINNED_MODELS` e `TASK_MODEL_EXTERNAL`.
4. Reinicie `hvac-rag.service` e `openwebui-hvac`.
5. Rode os comandos de verificação acima.
