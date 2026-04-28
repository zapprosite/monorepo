---
name: SPEC-033 HVAC Manual Browser-Use Download Agent
description: Pipeline de download de manuais HVAC via browser-use agent com Chrome profile persistente + login automático via Infisical. Baseado no perplexity-agent existente.
type: specification
---

# SPEC-033: HVAC Manual Browser-Use Download Agent

**Status:** DRAFT
**Created:** 2026-04-12
**Author:** will
**Related:** SPEC-032, SPEC-026, perplexity-agent (/srv/monorepo/apps/perplexity-agent)
**Priority:** HIGH

---

## 1. Objective

Criar um **browser-use agent** especializado em baixar manuais PDF de sites de fabricantes HVAC (LG, Samsung, Daikin, Springer) usando:
- Chrome profile persistente (cookies de login)
- browser-use (GPT-4o-mini via OpenRouter)
- Credenciais em Infisical
- Download para `/srv/data/hvac-manuals/`

**Fluxo:**
```
Chrome Profile (login salvo)
    ↓
browser-use Agent (navega + baixa)
    ↓
PDFs salvos em /srv/data/hvac-manuals/{brand}/
    ↓
docling (SPEC-032) processa → markdown
    ↓
nomic-embed-text → Qdrant
```

---

## 2. Arquitetura

### 2.1 Componentes

```
hvac-manual-downloader/
├── agent/
│   ├── __init__.py
│   ├── browser_agent.py      # browser-use agent (baseado em perplexity-agent)
│   ├── chrome_profile.py      # Chrome profile management
│   └── credentials.py        # Infisical credential management
├── tasks/
│   ├── __init__.py
│   ├── lg_downloader.py      # LG Brazil specific logic
│   ├── samsung_downloader.py # Samsung Brazil specific logic
│   ├── daikin_downloader.py  # Daikin Brasil specific logic
│   └── springer_downloader.py # Springer/Midea specific logic
├── download_manager.py        # Orchestrates all downloads
├── config.py                   # Config loading
├── requirements.txt
└── README.md
```

### 2.2 Fluxo de Execução

```python
# 1. Carrega credenciais do Infisical
credentials = load_credentials_from_infisical()
# → LG_BRAZIL_EMAIL, LG_BRAZIL_PASSWORD
# → SAMSUNG_BRAZIL_EMAIL, SAMSUNG_BRAZIL_PASSWORD
# → DAIKIN_BRAZIL_EMAIL, DAIKIN_BRAZIL_PASSWORD

# 2. Chrome profile com cookies persistidos
# Se não existe login, abre browser para usuário fazer login manual uma vez
# Depois disso, cookies ficam salvos no profile

# 3. browser-use agent executa tasks
agent = BrowserUseAgent(chrome_profile_path)
task = "Navigate to LG Brazil support page, login with provided credentials,
        find model AR-09NS1, download the service manual PDF to /srv/data/hvac-manuals/lg/"
agent.execute(task)

# 4. Salva PDFs em /srv/data/hvac-manuals/{brand}/{model}.pdf
```

---

## 3. Chrome Profile Strategy

### 3.1 Profile Persistence

```python
CHROME_PROFILE_PATH = "/srv/data/hvac-manual-downloader/chrome-profiles/{brand}"

# Cada brand tem seu próprio profile
profiles = {
    "lg": "/srv/data/hvac-manual-downloader/chrome-profiles/lg",
    "samsung": "/srv/data/hvac-manual-downloader/chrome-profiles/samsung",
    "daikin": "/srv/data/hvac-manual-downloader/chrome-profiles/daikin",
    "springer": "/srv/data/hvac-manual-downloader/chrome-profiles/springer",
}
```

### 3.2 Login Flow (One-Time)

```python
def ensure_logged_in(brand: str):
    """Garante que o Chrome profile tem sessão válida."""
    profile_path = PROFILES[brand]

    if not has_valid_session(profile_path):
        # Abre browser com credenciais
        browser = launch_chrome(profile_path)
        navigate_to_login_page(brand)
        # Usuário faz login manualmente OU
        # Usa credenciais via auto-fill
        wait_for_session_cookie(browser)
        save_session(profile_path)
```

### 3.3 Reutilização de Session

```python
def download_manual(brand: str, model_url: str, output_path: str):
    """Download manual usando sessão salva."""
    profile_path = PROFILES[brand]

    if not has_valid_session(profile_path):
        raise RuntimeError(f"No valid session for {brand}. Run login first.")

    agent = BrowserUseAgent(profile_path)
    task = f"""
    1. Go to {model_url}
    2. Click download button if available
    3. Wait for PDF download to complete
    4. Save file to {output_path}
    """
    agent.execute(task)
```

---

## 4. Credential Management (Infisical)

### 4.1 Secrets a Registrar

```python
# Infisical project: hvacr-swarm (mesmo do perplexity-agent)
# Environment: dev

SECRETS = {
    # LG Brazil
    "LG_BRAZIL_EMAIL": "tecnico.hvac@zappro.site",
    "LG_BRAZIL_PASSWORD": "***",

    # Samsung Brazil
    "SAMSUNG_BRAZIL_EMAIL": "tecnico.hvac@zappro.site",
    "SAMSUNG_BRAZIL_PASSWORD": "***",

    # Daikin Brasil
    "DAIKIN_BRAZIL_EMAIL": "tecnico.hvac@zappro.site",
    "DAIKIN_BRAZIL_PASSWORD": "***",

    # Springer/Midea
    "SPRINGER_BRAZIL_EMAIL": "tecnico.hvac@zappro.site",
    "SPRINGER_BRAZIL_PASSWORD": "***",
}
```

### 4.2 Infisical SDK Pattern (igual perplexity-agent)

```python
from infisical_sdk import InfisicalSDKClient
import os

TOKEN_PATH = "/srv/ops/secrets/infisical.service-token"

def get_secret(secret_key: str) -> str:
    token = open(TOKEN_PATH).read().strip()
    client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
    secrets = client.secrets.list_secrets(
        project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
        environment_slug='dev',
        secret_path='/'
    )
    for s in secrets.secrets:
        if s.secret_key == secret_key:
            return s.secret_value
    raise KeyError(f"Secret {secret_key} not found")
```

---

## 5. browser-use Agent (GPT-4o-mini/OpenRouter)

### 5.1 Baseado no perplexity-agent

```python
# apps/hvac-manual-downloader/agent/browser_agent.py
from browser_use import Agent
from langchain_openai import ChatOpenAI

def get_llm():
    api_key = get_secret("OPENROUTER_API_KEY")  # Já existe no Infisical
    return ChatOpenAI(
        model="openai/gpt-4o-mini",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )

def create_agent(chrome_profile_path: str):
    llm = get_llm()
    return Agent(
        task="You are a helpful assistant that downloads HVAC manuals.",
        llm=llm,
        chrome_profile_path=chrome_profile_path,
    )
```

### 5.2 Task Templates

```python
TASK_TEMPLATES = {
    "lg_brazil": """
    1. Navigate to https://www.lg.com/br/suporte/manuais
    2. Search for model: {model_number}
    3. If login required, enter credentials:
       Email: {email}
       Password: {password}
    4. Find the service manual PDF
    5. Click download button
    6. Wait for download to complete
    7. Save to: {output_path}
    """,

    "samsung_brazil": """
    1. Navigate to https://www.samsung.com/br/support/manuals/
    2. Search for model: {model_number}
    3. If login required, enter credentials
    4. Download service manual PDF
    5. Save to: {output_path}
    """,

    "daikin_brazil": """
    1. Navigate to https://www.daikin.com.br/profissionais/downloads
    2. Select product category: {category}
    3. Find model: {model_number}
    4. Download service manual PDF
    5. Save to: {output_path}
    """,
}
```

---

## 6. Model Number Patterns (TAG)

### 6.1 Padrões Conhecidos (Pesquisa Futura)

| Brand | Indoor Model Pattern | Outdoor Model Pattern | TAG Location |
|-------|---------------------|----------------------|--------------|
| LG | AR-09NS1, AR-12NS1, AR-18NS1 | UT-09NE1, UT-12NE1, UT-18NE1 | Unit side panel |
| Samsung | AR09NXD1, AR12NXD1 | AM09NXD1, AM12NXD1 | Rear of unit |
| Daikin | FTXB35, FTXB50 | RXB35, RXB50 | Front panel |
| Springer | Xtreme Save, Xtreme Connect | Xtreme Save Inverter | Side panel |
| Midea | Midea 9.000, Midea 12.000 | Midea 9K Inverter | Tag on unit |

### 6.2  (Formatos Típicos)

```
LG Brasil:
  - Split: AR-{capacidade}{N}{S}{série}
    - AR-09NS1 (9.000 BTU, N-series, S1 variant)
    - AR-12NS2 (12.000 BTU, N-series, S2 variant)
  - Consul:
    - CB-09, CB-12 ( capacitance in BTU)

Samsung:
  - AR{capatiy}{letters}{digit}
    - AR09NXD1, AR12NXD1
  - Console: AN09NV1, AN12NV1

Daikin:
  - FTX{capatiy}{letters}
    - FTXB35, FTXB50 (2.5, 5.0 kW)
  - Outdoor: RXB35, RXB50

Springer:
  - Xtreme Save Connect 9K, 12K, 18K
  - Xtreme Inverter 9K, 12K, 18K

Midea:
  - 9K, 12K, 18K (capacity based)
  - Martian 9K, Martian 12K
```

---

## 7. Directory Structure

```
/srv/data/hvac-manual-downloader/
├── chrome-profiles/
│   ├── lg/
│   ├── samsung/
│   ├── daikin/
│   └── springer/
├── downloads/
│   ├── lg/
│   ├── samsung/
│   ├── daikin/
│   └── springer/
├── logs/
└── state/
    └── session_state.json  # Track which sessions are valid

/srv/data/hvac-manuals/  # Output final (após download)
├── lg/
├── samsung/
├── daikin/
└── springer/
```

---

## 8. Comandos

```bash
# Login inicial (uma vez)
python -m hvac_manual_downloader login --brand lg

# Download de manual específico
python -m hvac_manual_downloader download --brand lg --model AR-09NS1

# Batch download (lista de modelos)
python -m hvac_manual_downloader batch --brand lg --models-file models.json

# Verificar status das sessões
python -m hvac_manual_downloader status

# Sync com SPEC-032 (docling pipeline)
python -m hvac_manual_downloader process --input /srv/data/hvac-manuals/ --output /srv/data/hvac-manuals-processed/
```

---

## 9. Error Handling

| Error | Handling |
|-------|----------|
| Login falhou | Retry 3x com delay 5s, marcar profile como invalid |
| PDF não encontrado | Log warning, skip modelo, continuar batch |
| Download timeout | Retry 2x com timeout 60s |
| Session expirada | Recriar sessão via browser automation |
| Rate limited | Delay 30s entre requests, exponential backoff |

---

## 10. Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Login via browser automation funciona para LG Brazil | `python -m hvac_manual_downloader login --brand lg` sem erro |
| AC-2 | Chrome profile persiste cookies entre execuções | 2a execução não requer login |
| AC-3 | Download manual LG via browser-use agent | PDF salvo em `/srv/data/hvac-manuals/lg/` |
| AC-4 | Batch download 5 modelos sem erro | Verificar 5 PDFs baixados |
| AC-5 | Session state tracking funciona | `status` mostra sessões válidas/inválidas |
| AC-6 | Credenciais nunca em código (só Infisical) | Code review: sem strings de credenciais |
| AC-7 | Integração com SPEC-032 (docling) | PDF processado → markdown |

---

## 11. Open Questions

| # | Question | Priority |
|---|----------|----------|
| OQ-1 | LG/Samsung requieren login real de técnico ou conta criada funciona? | HIGH |
| OQ-2 | Quantos modelos devem ser baixados para MVP? | MEDIUM |
| OQ-3 | Chrome profile pode ser compartilhado entre brands? | LOW |

---

## 12. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| browser-use | NEW | Python package for browser automation |
| langchain-openai | EXISTING | Já usado no perplexity-agent |
| Infisical SDK | EXISTING | Mesmo padrão perplexity-agent |
| Chrome/Chromium | NEW | Precisa instalar no container |
| SPEC-032 | DRAFT | Docling pipeline |

---

## 13. Non-Goals

- Este spec NÃO cobre scraping de sites sem login (ManualsLib, etc)
- NÃO cobre o docling (SPEC-032 faz isso)
- NÃO cobre indexing no Qdrant (SPEC-026/031 faz isso)

---

## 14. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-12 | Usar browser-use em vez de Playwright direto | Mais alto nível, mesmo poder |
| 2026-04-12 | Chrome profile por brand | Evita conflitos de sessão |
| 2026-04-12 | GPT-4o-mini via OpenRouter | Custo-benefício vs GPT-4 |