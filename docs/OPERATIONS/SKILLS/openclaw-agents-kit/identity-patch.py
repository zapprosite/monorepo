# Identity Patch — Safe Update Without Losing Context

**Data:** 2026-04-09

## Problem

Updating identity in `openclaw.json` often overwrites existing configuration, losing context like:
- Agent definitions
- Channel configurations
- Skills entries
- Bindings

## Solution

`identity_patch()` — reads existing config, merges identity updates, preserves everything else.

```python
import json
from typing import Dict, Any

def patch_identity(
    config_path: str,
    identity_updates: Dict[str, Any],
    backup: bool = True
) -> Dict[str, Any]:
    """
    Patch identity in openclaw.json WITHOUT losing existing context.

    Args:
        config_path: Path to openclaw.json
        identity_updates: Dict with identity fields to update
            - name: str
            - theme: str
            - emoji: str
        backup: Create .bak backup before writing

    Returns:
        The updated identity block

    Example:
        patch_identity("/data/.openclaw/openclaw.json", {
            "name": "Zappro",
            "theme": "assistente de voz PT-BR",
            "emoji": "🎙️"
        })
    """
    # Load existing config
    with open(config_path, 'r') as f:
        config = json.load(f)

    # Create backup
    if backup:
        import shutil
        import datetime
        shutil.copy(config_path, f"{config_path}.bak-{datetime.now().strftime('%Y%m%d')}")

    # Ensure identity block exists
    if 'identity' not in config:
        config['identity'] = {}

    # Merge identity updates (preserve existing keys)
    config['identity'].update(identity_updates)

    # Write back
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

    return config['identity']
```

## Usage

```python
# Update identity only
new_identity = patch_identity(
    "/data/.openclaw/openclaw.json",
    {
        "name": "Zappro",
        "theme": "assistente de voz PT-BR, eficiente e profissional",
        "emoji": "🎙️"
    }
)
print(f"Updated identity: {new_identity}")

# Verify
with open("/data/.openclaw/openclaw.json") as f:
    config = json.load(f)
    print(config['identity'])
```

## Verify After Patch

```bash
# Check identity
docker exec openclaw-container cat /data/.openclaw/openclaw.json | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('identity:', d.get('identity',{}))"

# Verify nothing else changed
docker exec openclaw-container cat /data/.openclaw/openclaw.json | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('agents count:', len(d.get('agents',{}).get('list',[])))"
```

## Rollback

```bash
# If something went wrong
docker exec openclaw-container cp \
  /data/.openclaw/openclaw.json.bak-YYYYMMDD \
  /data/.openclaw/openclaw.json
```

---

**Data:** 2026-04-09