# OAuth Login Guide — OpenClaw CEO MIX

**Data:** 2026-04-08
**Objetivo:** Login OAuth persistente para Gemini + Perplexity no browser do OpenClaw

---

## Overview

O OpenClaw (CEO MIX agent) precisa de sessão OAuth ativa em localhost:4004 para comandar o Perplexity Agent. Este guia explica como fazer login e manter sessões persistentes.

---

## Passo 1: Verificar Chrome Profile

```bash
ls -la /srv/data/perplexity-agent/chrome-profile/
```

**Esperado:**
```
drwx------ 3 will will  4096 Apr  8 05:03 .
drwxr-xr-x 2 will will  4096 Apr  8 05:03 Default/
```

**Se não existir, criar:**
```bash
mkdir -p /srv/data/perplexity-agent/chrome-profile/Default
chmod -R 777 /srv/data/perplexity-agent/chrome-profile/
```

---

## Passo 2: Abrir Chrome com Debug

Este comando abre o Chrome no desktop com o profile do OpenClaw:

```bash
/usr/bin/google-chrome --profile-directory=Default --user-data-dir=/srv/data/perplexity-agent/chrome-profile --remote-debugging-port=9222
```

Copie e cole **tudo em uma linha**.

---

## Passo 3: Fazer Login

1. Chrome abre no desktop
2. Navegue para: **https://localhost:4004**
3. Login com conta **Google** (ex: `will.gemini@gmail.com`)
4. Aguarde página carregar completamente
5. **NÃO FECHE O CHROME** enquanto faz o próximo passo

---

## Passo 4: Verificar Login

No Chrome aberto:
- Verifique que está logado em localhost:4004
- Foto/avatar no canto superior = LOGIN OK

---

## Passo 5: Testar no Perplexity Agent

```bash
curl -s http://localhost:4004/_stcore/health
```

**Esperado:** `{"status":"ok"}`

Acesse: **http://localhost:4004** — deve mostrar sessão ativa.

---

## Login com DuaS Contas

### Conta 1: Gemini
```bash
/usr/bin/google-chrome \
  --profile-directory=Default \
  --user-data-dir=/srv/data/perplexity-agent/chrome-profile \
  --remote-debugging-port=9222
```
→ Login com `will.gemini@gmail.com`

### Conta 2: Perplexity
```bash
/usr/bin/google-chrome \
  --profile-directory=PerplexityAccount \
  --user-data-dir=/srv/data/perplexity-agent/chrome-profile-perplexity \
  --remote-debugging-port=9223
```
→ Login com `will.perplexity@gmail.com`

---

## Troubleshooting

### "Chrome not found"
```bash
which google-chrome
ls /usr/bin/*chrom*
```

### "Permission denied" no user-data-dir
```bash
chmod -R 777 /srv/data/perplexity-agent/chrome-profile/
```

### Cookie não persiste após restart
```bash
ls -la /srv/data/perplexity-agent/chrome-profile/Default/
```

### CDP não conecta
```bash
curl -s http://localhost:9222/json | head
```

---

## Referências

| Recurso | URL |
|---------|-----|
| Perplexity Agent (web.zappro.site legacy) | http://localhost:4004 |
| Perplexity Agent UI | http://localhost:4004 |
| Chrome DevTools | chrome://inspect |
| Google OAuth Console | https://console.cloud.google.com/apis/credentials |

---

## Quick Reference

| Ação | Comando |
|------|---------|
| Abrir Chrome logado | `/usr/bin/google-chrome --profile-directory=Default --user-data-dir=/srv/data/perplexity-agent/chrome-profile --remote-debugging-port=9222` |
| Verificar cookies | `ls -la /srv/data/perplexity-agent/chrome-profile/Default/` |
| Testar health | `curl -s http://localhost:4004/_stcore/health` |
| Ver CDP endpoints | `curl -s http://localhost:9222/json` |

---

**Após login, o CEO MIX (OpenClaw) consegue usar essa sessão automaticamente!**
