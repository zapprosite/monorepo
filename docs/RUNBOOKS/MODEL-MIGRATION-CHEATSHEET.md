# 🧠 Guia de Migração e Substituição de Modelos (Nexus)

Este guia "mastigado" explica como alterar os modelos do Homelab sem quebrar o sistema, garantindo que os scripts continuem funcionando independentemente de qual motor (Ollama, Llama.cpp) ou modelo você esteja usando.

---

## 🏗️ A Regra de Ouro: O Alias é Sagrado
**NUNCA** altere o nome do alias (ex: `nexus-auto`, `nexus-vision`) nos scripts. Se você mudar o modelo físico, altere **apenas** no `config/litellm/config.yaml`. Isso mantém o sistema desacoplado.

---

## 🛠️ Caso 1: Trocar o Modelo no Ollama
Se você baixou um modelo novo (ex: `deepseek-coder` em vez de `qwen2.5-coder`) e quer que ele seja o padrão:

1. Edite `config/litellm/config.yaml`:
```yaml
  - model_name: nexus-local-code  # Mantenha o alias
    litellm_params:
      model: ollama/deepseek-v3    # Mude apenas aqui o nome do modelo físico
      api_base: "http://host.docker.internal:11434"
```

---

## 🖼️ Caso 2: Sem Modelo de Visão Local (Usar Nuvem)
Se o seu PC está pesado e você removeu o `qwen2.5-vl`, aponte o alias de visão para a nuvem (OpenRouter ou Gemini):

1. Edite `config/litellm/config.yaml`:
```yaml
  - model_name: nexus-vision
    litellm_params:
      model: openrouter/google/gemini-flash-1.5  # O LiteLLM faz o de-para automático
      api_key: "os.environ/OPENROUTER_API_KEY"
```
*Agora o `hvac_vision.py` continuará funcionando, mas usará a API externa de forma transparente.*

---

## 🚀 Caso 3: Mudar de Ollama para Llama.cpp
Se você decidiu usar o `llama.cpp` (server) para ganhar performance:

1. Inicie o `llama.cpp` na porta `8080`.
2. Edite `config/litellm/config.yaml`:
```yaml
  - model_name: nexus-auto
    litellm_params:
      model: openai/any  # Llama.cpp é compatível com o formato OpenAI
      api_base: "http://host.docker.internal:8080/v1"
      api_key: "sk-not-needed"
```

---

## 🧩 Resumo de Comandos para Emergência

### 1. Verificar se o LiteLLM "viu" o novo modelo:
```bash
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" http://localhost:4018/v1/models | jq '.data[].id'
```

### 2. Testar o modelo novo via CLI:
```bash
# Testando o alias independente do que está atrás (Ollama ou Llama.cpp)
curl -X POST http://localhost:4018/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
     -d '{
       "model": "nexus-auto",
       "messages": [{"role": "user", "content": "Olá, teste"}]
     }'
```

---

## ⚠️ Checklist de "Deu Ruim"

| Problema | Causa Provável | Solução |
| :--- | :--- | :--- |
| **ModelNotFound** | O nome no `config.yaml` não bate com o `ollama list` | Rode `ollama list` e copie o nome EXATO. |
| **Connection Refused** | O Llama.cpp ou Ollama não estão rodando | Verifique o serviço (`systemctl status` ou Docker). |
| **Timeout** | O modelo é pesado demais para a GPU | Aumente o `timeout` no `config.yaml` ou reduza o contexto. |
| **Erro de Visão** | Tentou usar modelo de chat para visão | Garanta que o modelo físico suporta imagens. |

---

## 📝 Como agir passo-a-passo:
1. **Instale** o novo motor/modelo.
2. **Atualize** o `config/litellm/config.yaml` mapeando o `model_name` (alias) para o novo `model` (físico).
3. **Reinicie** o proxy: `docker restart litellm-proxy`.
4. **Valide** com o comando `curl` acima.
