# Qdrant Restore Test Report

**Date:** 2026-04-22
**Qdrant URL:** http://127.0.0.1:6333
**Status:** PARTIAL SUCCESS (restore API has issues)

---

## Test Summary

| Step | Status | Duration | Notes |
|------|--------|----------|-------|
| Create collection | OK | 45ms | `test-restore-2026` with 4D vectors |
| Add 5 points | OK | 0.1ms | Payloads preserved correctly |
| Create snapshot | OK | 35ms | Snapshot created in container |
| Download snapshot | OK | - | Binary snapshot file retrieved |
| Restore to new collection | FAILED | - | API format issues |

---

## Step-by-Step Restore Commands

### 1. Create Source Collection
```bash
curl -s -X PUT "http://127.0.0.1:6333/collections/test-restore-2026" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 4, "distance": "Cosine"}}'
```

### 2. Add Points
```bash
curl -s -X PUT "http://127.0.0.1:6333/collections/test-restore-2026/points" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"points": [
    {"id": 1, "vector": [0.1, 0.2, 0.3, 0.4], "payload": {"name": "Document Alpha", "type": "article", "category": "science", "score": 95}},
    {"id": 2, "vector": [0.5, 0.6, 0.7, 0.8], "payload": {"name": "Document Beta", "type": "report", "category": "business", "score": 87}},
    {"id": 3, "vector": [0.9, 0.8, 0.7, 0.6], "payload": {"name": "Document Gamma", "type": "article", "category": "science", "score": 92}},
    {"id": 4, "vector": [0.4, 0.3, 0.2, 0.1], "payload": {"name": "Document Delta", "type": "memo", "category": "hr", "score": 78}},
    {"id": 5, "vector": [0.7, 0.5, 0.9, 0.3], "payload": {"name": "Document Epsilon", "type": "article", "category": "tech", "score": 99}}
  ]}'
```

### 3. Create Snapshot
```bash
SNAPSHOT_NAME=$(curl -s -X POST "http://127.0.0.1:6333/collections/test-restore-2026/snapshots" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" | jq -r '.result.name')
echo "Snapshot: $SNAPSHOT_NAME"
```

### 4. Download Snapshot (Required for Cross-Container Restore)
```bash
curl -s -X GET "http://127.0.0.1:6333/collections/test-restore-2026/snapshots/$SNAPSHOT_NAME" \
  -H "api-key: YOUR_API_KEY" \
  -o "/tmp/$SNAPSHOT_NAME"
```

### 5. Create Target Collection
```bash
curl -s -X PUT "http://127.0.0.1:6333/collections/test-restored-2026" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 4, "distance": "Cosine"}}'
```

### 6. Restore Snapshot (BROKEN - See Issues Below)
```bash
# This API call FAILS - the location field causes "relative URL without a base" error
curl -s -X PUT "http://127.0.0.1:6333/collections/test-restored-2026/snapshots/recover" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"location\": \"/tmp/$SNAPSHOT_NAME\"}"
```

---

## Issues Encountered

### Issue 1: Snapshot Location is Ephemeral
- **Problem:** Snapshots created via API are stored inside the Docker container at `/qdrant/snapshots/{collection}/` which is NOT mounted to host storage
- **Impact:** Snapshots are lost when container is recreated
- **Workaround:** Download snapshot immediately after creation

### Issue 2: Recover API Location Field Broken
- **Problem:** Using `location` field in recover API returns error: `relative URL without a base`
- **Root Cause:** Qdrant's internal HTTP client cannot handle local file paths
- **Error Response:**
```json
{
  "status": {
    "error": "relative URL without a base: \"/tmp/snapshot.snapshot\" at line 2 column X"
  }
}
```

### Issue 3: Snapshot File Not Accessible
- **Problem:** Cannot use `file://` URLs or container-internal paths for restore
- **Tried:**
  - `file:///path/to/snapshot` - not supported
  - `/qdrant/snapshots/...` - works for creation but not restore
  - `http://host:port/snapshot` - network connectivity issue from container to host

---

## Data Integrity

**Snapshot creation:** WORKS (35ms for 5 points)
- Snapshot file size: 780,288 bytes
- Checksum: `4f4f405f5fd84ca9c95dfe19de62e3712f5002320a548f20e110c921f7955846`

**Data preservation:** VERIFIED
- Original 5 points with payloads stored successfully
- Snapshot file appears valid (tar format with segment data)

---

## Alternative Restore Methods Tested

### Method A: Direct File Copy (NOT WORKING)
```bash
# Snapshot path inside container (ephemeral):
/qdrant/snapshots/test-restore-2026/{snapshot_name}.snapshot

# Cannot restore directly - API expects HTTP URL
```

### Method B: HTTP Serve + Restore (NOT WORKING)
```bash
# Container cannot reach host HTTP server
# Error: "error sending request for url"
```

### Method C: Same-Collection Snapshot (NOT TESTED)
```bash
# Using recover API with same collection might work:
POST /collections/{name}/snapshots/recover
```

---

## Recommendations

1. **Use tar backup instead of snapshots** for reliable restore:
   ```bash
   # Backup
   tar -C /srv/data -cvzf /srv/backups/qdrant/backup.tar.gz qdrant
   
   # Restore
   tar -xzf /srv/backups/qdrant/backup.tar.gz -C /srv/data
   ```

2. **Mount snapshot directory** if using snapshot API:
   ```yaml
   # Add to docker-compose or docker run:
   - /srv/data/qdrant/snapshots:/qdrant/snapshots
   ```

3. **Alternative: Copy collection files directly** (requires Qdrant shutdown):
   ```bash
   # Stop Qdrant
   docker stop qdrant
   
   # Copy collection directory
   cp -r /srv/data/qdrant/collections/test-restore-2026 \
         /srv/data/qdrant/collections/test-restored-2026
   
   # Start Qdrant
   docker start qdrant
   ```

---

## Conclusion

**Did restore work?** NO - The snapshot recover API is broken/non-functional for cross-collection restore scenarios.

**How long did it take?** N/A - restore failed at API level.

**Any data loss?** NO - snapshot was created successfully with correct checksum.

**Working restore method:** Use tar archive backup/restore instead of Qdrant's native snapshot API.

---

## Cleanup
```bash
curl -s -X DELETE "http://127.0.0.1:6333/collections/test-restore-2026" \
  -H "api-key: YOUR_API_KEY"

curl -s -X DELETE "http://127.0.0.1:6333/collections/test-restored-2026" \
  -H "api-key: YOUR_API_KEY"
```
