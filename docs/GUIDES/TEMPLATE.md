# GUIDE-TEMPLATE.md — How-to Guide Template

**Status:** ACTIVE
**Template Version:** 1.0
**Created:** 2026-04-10
**Owner:** will

---

## Overview

This template provides the standard structure for all how-to guides in the `/srv/monorepo/docs/GUIDES/` directory. Follow this template exactly when creating new operational guides.

---

## When to Use This Template

Use this template when creating:

- **Operational guides** — Step-by-step instructions for maintaining services
- **Troubleshooting guides** — Problem diagnosis and resolution procedures
- **Maintenance procedures** — Recurring operational tasks
- **Workflow guides** — How to execute multi-step processes

### When NOT to Use This Template

- **Feature specifications** — Use `SPEC-TEMPLATE.md` in `docs/SPECS/`
- **Architecture decisions** — Use `ADR-TEMPLATE.md` in `docs/ADRs/`
- **Reference documentation** — Use `REFERENCE-TEMPLATE.md` in `docs/REFERENCE/`

---

## Template Structure

````markdown
# [Title — Imperative Verb]

**Data:** YYYY-MM-DD
**Prerequisites:** [Prereq-1], [Prereq-2]
**Est. Time:** [duration]

---

## Overview

[Brief description of what this guide accomplishes and when to use it.]

## Prerequisites

Before starting, ensure you have:

- [ ] **[Requirement 1]** — [Brief explanation]
- [ ] **[Requirement 2]** — [Brief explanation]
- [ ] **[Requirement 3]** — [Brief explanation]

### Required Access

- [ ] SSH access to target host
- [ ] Required environment variables configured
- [ ] Necessary permissions (sudo/systemd)

### Related Services

If applicable, list services that must be running:

| Service | Port    | Required |
| ------- | ------- | -------- |
| [Name]  | :[port] | Yes/No   |

---

## Step-by-Step Instructions

### Step 1: [Action Name]

[Detailed explanation of what to do and why.]

```bash
# Example command or code block
command --flag argument
```
````

**Expected output:**

```
example output showing success
```

### Step 2: [Action Name]

[Detailed explanation.]

```bash
# Another example
curl -s http://localhost:PORT/health | jq
```

### Step 3: [Action Name]

[Detailed explanation with caveats.]

**Caution:** [Any safety warnings]

```bash
# Destructive or important commands
sudo systemctl restart service-name
```

---

## Verification Steps

After completing the guide, verify success:

### Health Check

```bash
# Verify service is responding
curl -s http://localhost:PORT/health
```

**Expected:** `{"status":"healthy"}` or similar

### Log Verification

```bash
# Check service logs for errors
journalctl -u SERVICE_NAME -n 50 --no-pager
```

### Functional Test

```bash
# Run a functional test
bash /path/to/test-script.sh
```

**Expected:** [Description of expected outcome]

---

## Common Issues

### Issue 1: [Short Description]

**Symptoms:**

- [Symptom A]
- [Symptom B]

**Diagnosis:**

```bash
# Diagnostic command
command --diagnose
```

**Resolution:**

```bash
# Fix command
fix-command
```

---

### Issue 2: [Short Description]

**Symptoms:**

- [Symptom A]

**Diagnosis:**

```bash
# Diagnostic command
curl -s http://localhost:PORT/status | jq
```

**Resolution:**

```bash
# Restart affected service
sudo systemctl restart SERVICE_NAME
```

---

## Rollback Procedure

If something goes wrong:

```bash
# Stop the failed operation
sudo systemctl stop SERVICE_NAME

# Restore previous state
git stash pop  # or restore from backup
sudo systemctl restart SERVICE_NAME
```

---

## Related Documentation

- [Related Guide Name](./guide-name.md) — [Brief description]
- [Service Documentation](../REFERENCE/service-name.md) — [Brief description]
- [Architecture Decision](../ADRs/ADR-NNN-title.md) — [Brief description]

---

## Changelog

### v1.0 (YYYY-MM-DD)

- Initial version

````

---

## Example: Based on Voice Pipeline Desktop Guide

```markdown
# Voice Pipeline Desktop — Smoke Test & Gap Analysis

**Data:** 2026-04-10
**Prerequisites:** Docker, Ollama, whisper_api.py
**Est. Time:** 5 minutes

---

## Overview

This guide performs a smoke test on the voice pipeline desktop setup, verifying all services, models, and scripts are operational. Run this before extended use or after system restart.

## Prerequisites

Before starting, ensure you have:

- [ ] **Docker** — Container runtime for Kokoro and OpenClaw
- [ ] **Ollama** — Local LLM inference server
- [ ] **whisper_api.py** — STT service running natively (not Docker)
- [ ] **Kokoro TTS** — Docker container `zappro-kokoro`
- [ ] **Models downloaded** — `Qwen3-VL-8B-Instruct`, `llama3-portuguese-tomcat-8b-instruct-q8`

### Required Services

| Service | Port | Required |
|---------|------|----------|
| Kokoro TTS | :8012 | Yes |
| Whisper API | :8201 | Yes |
| Ollama | :11434 | Yes |
| wav2vec2-proxy | Docker | Yes |
| OpenClaw | :8080 | Yes |

---

## Step-by-Step Instructions

### Step 1: Verify Services Are Running

Check all services are listening on their respective ports:

```bash
# Check all ports
ss -tlnp | grep -E ':(8012|8201|11434|8080)'
````

**Expected output:**

```
LISTEN  0.5  127.0.0.1:8012   0.0.0.0:*  users:(("docker-proxy",pid=12345,fd=4))
LISTEN  0.5  127.0.0.1:8201   0.0.0.0:*  users:(("python3",pid=6789,fd=4))
LISTEN  0.5  127.0.0.1:11434  0.0.0.0:*  users:(("ollama",pid=1122,fd=3))
```

### Step 2: Verify Ollama Models

```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

**Expected output:**

```json
[
  "llama3-portuguese-tomcat-8b-instruct-q8:latest",
  "Qwen3-VL-8B-Instruct",
  "nomic-embed-text:latest"
]
```

### Step 3: Test STT Pipeline

```bash
# Record a test audio clip
bash /home/will/Desktop/voice-pipeline/scripts/record.sh
# Speak into microphone, press ENTER to stop

# Process with voice.sh
bash /home/will/Desktop/voice-pipeline/scripts/voice.sh /tmp/test_audio.wav
```

**Expected output:**

```
[voice.sh output showing transcription and LLM response]
```

### Step 4: Test TTS Pipeline

```bash
# Test Kokoro directly
echo "Testing voice pipeline" | bash /home/will/Desktop/voice-pipeline/scripts/speak.sh
```

**Expected output:**

```
Audio plays through headset (pm_santa voice)
```

---

## Verification Steps

### Health Check All Services

```bash
# Comprehensive health check
for port in 8012 8201 11434 8080; do
  curl -sf http://localhost:$port/health 2>/dev/null && echo ":$port OK" || echo ":$port FAIL"
done
```

**Expected:** All ports report OK

### GPU Memory Check

```bash
# Check VRAM usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

**Expected:** Memory usage within normal bounds (typically < 20GiB for this setup)

### Hotkey Verification

```bash
# Verify F12 binding exists
gsettings get org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ binding
```

**Expected:** `'F12'`

---

## Common Issues

### Issue 1: F12 Hotkey Disappears After Reboot

**Symptoms:**

- F12 no longer triggers recording
- `voice-toggle.sh` click works but hotkey does not

**Diagnosis:**

```bash
gsettings get org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ binding
```

**Expected:** `'F12'`
**Actual (when broken):** `''` or key not found

**Resolution:**

```bash
# Restore hotkey binding
/home/will/Desktop/voice-pipeline/scripts/hotkey-restore.sh

# Or manually:
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ binding "'F12'"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ command "'/home/will/Desktop/voice-pipeline/scripts/record.sh'"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/voice-f9/ name "'Voice Record (F12)'"
```

**Prevention:** Ensure `hotkey-restore.sh` is in `~/.config/autostart/`

---

### Issue 2: whisper_api.py Not Responding

**Symptoms:**

- STT fails with connection error
- Port :8201 not listening

**Diagnosis:**

```bash
ps aux | grep whisper_api
ss -tlnp | grep 8201
```

**Resolution:**

```bash
# Restart whisper_api.py
pkill -f whisper_api.py
bash /home/will/Desktop/voice-pipeline/scripts/start-whisper-api.sh &
```

---

### Issue 3: LLM Model Not Available

**Symptoms:**

- `voice.sh` fails with model not found error
- Ollama API returns empty model list

**Diagnosis:**

```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

**Resolution:**

```bash
# Pull the required model
ollama pull llama3-portuguese-tomcat-8b-instruct-q8:latest

# Verify
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

---

## Rollback Procedure

If the smoke test reveals critical failures:

```bash
# Stop all voice pipeline services
docker stop $(docker ps -q --filter "name=zappro-kokoro")
pkill -f whisper_api.py
pkill -f ollama

# Restore previous state via git
cd /home/will/Desktop/voice-pipeline
git stash
git stash pop

# Restart services
systemctl --user restart ollama
bash start-whisper-api.sh &
docker start zappro-kokoro
```

---

## Related Documentation

- [Voice Pipeline Loop](./voice-pipeline-loop.md) — Server-side voice pipeline
- [OpenClaw Audio Governance](../specflow/SPEC-009-openclaw-persona-audio-stack.md) — Audio stack rules
- [CODE-REVIEW-GUIDE](./CODE-REVIEW-GUIDE.md) — Code review standards

---

## Changelog

### v1.0 (2026-04-10)

- Initial template based on voice-pipeline-desktop smoke test

```

---

## Key Sections Explained

| Section | Purpose | Required |
|---------|---------|----------|
| **Overview** | What this guide accomplishes | Yes |
| **Prerequisites** | What must be in place before starting | Yes |
| **Step-by-Step** | Numbered instructions with commands | Yes |
| **Verification** | How to confirm success | Yes |
| **Common Issues** | Troubleshooting table | Yes |
| **Rollback** | How to undo if something goes wrong | Recommended |
| **Related Docs** | Cross-references to other docs | Yes |

---

## Formatting Rules

1. **Code blocks** — Always specify language for syntax highlighting:
   - `bash` for shell commands
   - `json` for JSON output
   - `yaml` for configuration files
   - `markdown` for markdown examples

2. **Tables** — Use for:
   - Service listings (name, port, status)
   - Issue symptom/cause/resolution mapping
   - Parameter descriptions

3. **Health checks** — Always provide:
   - The curl/command to check
   - Expected output format
   - Example output

4. **File:Line references** — Use format `path:line` not `path line`

---

## Naming Convention

- File names: `kebab-case.md` (e.g., `voice-pipeline-desktop.md`)
- Section headers: Sentence case (e.g., `## Overview`)
- Steps: Imperative verb (e.g., `### Step 1: Verify Services`)

---

## Related Templates

- [SPEC-TEMPLATE.md](../specflow/SPEC-TEMPLATE.md) — Feature specifications
- [ADR-TEMPLATE.md](../ADRs/ADR-TEMPLATE.md) — Architecture decisions
- [REFERENCE-TEMPLATE.md](../REFERENCE/REFERENCE-TEMPLATE.md) — Technical references
```
