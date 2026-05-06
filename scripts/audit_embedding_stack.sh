#!/usr/bin/env bash
set -euo pipefail

OK_DIRECT_EMBED=false
OK_LITELLM_EMBED=false
EMBED_CRITICAL_PATH=direct
EMBED_DIM=0
CRITICAL_FAIL=false

echo "== systemd =="
systemctl is-active nomic-embed-cpu

echo "== models =="
curl -sS --max-time 5 http://127.0.0.1:8002/v1/models | jq .

echo "== direct embedding =="
DIRECT_JSON="$(curl -sS --max-time 8 http://127.0.0.1:8002/v1/embeddings -H 'Content-Type: application/json' -d '{"model":"nomic-embed-cpu","input":"search_query: audit direct","encoding_format":"float"}')"
echo "$DIRECT_JSON" | jq '{ok:(.data!=null), len:(.data[0].embedding|length? // 0), err:(.error // null)}'
DIRECT_LEN="$(echo "$DIRECT_JSON" | jq -r '.data[0].embedding|length? // 0')"
if [[ "$DIRECT_LEN" == "768" ]]; then
  OK_DIRECT_EMBED=true
  EMBED_DIM=768
else
  CRITICAL_FAIL=true
fi

echo "== container to host =="
docker exec litellm-proxy python - <<'PY'
import json, urllib.request
url='http://172.17.0.1:8002/v1/embeddings'
data=json.dumps({'model':'nomic-embed-cpu','input':'search_query: audit container','encoding_format':'float'}).encode()
req=urllib.request.Request(url, data=data, headers={'Content-Type':'application/json'})
resp=urllib.request.urlopen(req, timeout=8)
body=json.loads(resp.read().decode())
print(json.dumps({'ok': body.get('data') is not None, 'len': len(body.get('data',[{'embedding':[]}])[0].get('embedding',[])), 'err': body.get('error')}))
PY

echo "== litellm embedding =="
set +u
source /srv/monorepo/.env >/dev/null 2>&1 || true
set -u
LITELLM_JSON="$(curl -sS --max-time 12 http://127.0.0.1:4018/v1/embeddings -H "Authorization: Bearer ${LITELLM_MASTER_KEY:-}" -H 'Content-Type: application/json' -d '{"model":"hermes-embed","input":"search_query: audit litellm","encoding_format":"float"}' || true)"
if [[ -n "$LITELLM_JSON" ]]; then
  echo "$LITELLM_JSON" | jq '{ok:(.data!=null), len:(.data[0].embedding|length? // 0), err:(.error.message // .error // null)}'
  if [[ "$(echo "$LITELLM_JSON" | jq -r '.data[0].embedding|length? // 0')" == "768" ]]; then
    OK_LITELLM_EMBED=true
  fi
else
  echo '{"ok":false,"len":0,"err":"timeout-or-empty"}'
fi
if [[ "$OK_LITELLM_EMBED" == "false" ]]; then
  echo "WARN: LiteLLM embedding path is best-effort only"
fi

echo "== gpu =="
nvidia-smi
nvidia-smi pmon -c 1
NOMIC_PID="$(systemctl show -p MainPID --value nomic-embed-cpu.service 2>/dev/null || true)"
GPU_PIDS="$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null | tr -d ' ' || true)"
if [[ -n "$NOMIC_PID" && "$NOMIC_PID" != "0" ]] && echo "$GPU_PIDS" | grep -qx "$NOMIC_PID"; then
  echo "ERROR: nomic-embed-cpu PID $NOMIC_PID is using GPU"
  CRITICAL_FAIL=true
fi

echo "OK_DIRECT_EMBED=$OK_DIRECT_EMBED"
echo "OK_LITELLM_EMBED=$OK_LITELLM_EMBED"
echo "EMBED_CRITICAL_PATH=$EMBED_CRITICAL_PATH"
echo "EMBED_DIM=$EMBED_DIM"

if [[ "$OK_DIRECT_EMBED" != "true" || "$EMBED_DIM" != "768" || "$CRITICAL_FAIL" == "true" ]]; then
  exit 1
fi
