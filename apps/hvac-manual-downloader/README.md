# HVAC Manual Downloader

Browser-use agent for downloading HVAC service manuals from manufacturer support sites.

## Overview

Specialized browser-use agent that downloads PDF service manuals from LG, Samsung, Daikin, and Springer Brazil support pages using:
- Chrome profile persistence (cookies saved between sessions)
- browser-use (GPT-4o-mini via OpenRouter)
- Credentials from Infisical vault
- Downloads to `/srv/data/hvac-manuals/{brand}/`

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Login to brand support (one-time per brand)
python -m hvac_manual_downloader login --brand lg

# Download manual for specific model
python -m hvac_manual_downloader download --brand lg --model AR-09NS1

# Batch download from JSON file
python -m hvac_manual_downloader batch --brand lg --models-file models.json

# Check session status
python -m hvac_manual_downloader status
```

## Architecture

```
hvac-manual-downloader/
├── agent/
│   ├── browser_agent.py      # browser-use Agent with OpenRouter
│   ├── chrome_profile.py     # Chrome profile management per brand
│   └── credentials.py        # Infisical credential management
├── tasks/
│   ├── lg_downloader.py      # LG Brazil task builder
│   ├── samsung_downloader.py # Samsung Brazil task builder
│   ├── daikin_downloader.py  # Daikin Brasil task builder
│   └── springer_downloader.py # Springer/Midea task builder
├── download_manager.py        # Orchestrates downloads across brands
├── config.py                  # Config loading
└── main.py                    # CLI entry point
```

## Data Layout

```
/srv/data/hvac-manual-downloader/
├── chrome-profiles/{brand}/   # Persistent Chrome profiles
├── downloads/{brand}/        # Raw downloads
├── logs/                      # Execution logs
└── state/session_state.json   # Session validity tracking

/srv/data/hvac-manuals/{brand}/  # Final manual PDFs
```

## Brand Credentials (Infisical)

| Brand | Email Key | Password Key |
|-------|-----------|--------------|
| lg | LG_BRAZIL_EMAIL | LG_BRAZIL_PASSWORD |
| samsung | SAMSUNG_BRAZIL_EMAIL | SAMSUNG_BRAZIL_PASSWORD |
| daikin | DAIKIN_BRAZIL_EMAIL | DAIKIN_BRAZIL_PASSWORD |
| springer | SPRINGER_BRAZIL_EMAIL | SPRINGER_BRAZIL_PASSWORD |

## Model Patterns

| Brand | Pattern Examples |
|-------|-----------------|
| LG | AR-09NS1, AR-12NS1, UT-09NE1 |
| Samsung | AR09NXD1, AR12NXD1, AM09NXD1 |
| Daikin | FTXB35, FTXB50, RXB35 |
| Springer | Xtreme Save Connect 9K, Martian 12K |

## Requirements

- Python 3.10+
- Chrome/Chromium
- Infisical SDK (`infisical-sdk`)
- browser-use
- langchain-openai
