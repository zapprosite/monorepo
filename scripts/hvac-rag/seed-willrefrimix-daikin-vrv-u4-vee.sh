#!/bin/bash
# Seed first field case from willrefrimix
# Daikin VRV U4-01 VEE diagnostic technique
#
# Usage:
#   cd /srv/monorepo
#   source .env  # Load database credentials
#   bash scripts/hvac-rag/seed-willrefrimix-daikin-vrv-u4-vee.sh
#
# Requires:
#   POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
#   QDRANT_HOST (or QDRANT_URL)
#   QDRANT_API_KEY (if authentication enabled)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== HVAC Field Expertise Memory - Seed Case ==="
echo "Author: willrefrimix"
echo "Brand: Daikin"
echo "Alarm: U4-01"
echo "Component: VEE"
echo ""

# Load env if available
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    echo "Loading environment from $PROJECT_ROOT/.env..."
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

python3 << 'PYTHON'
import os
import sys
sys.path.insert(0, '/srv/monorepo/scripts/hvac-rag')

try:
    from hvac_field_memory import insert_field_case, approve_field_case, index_field_case_approved
except ImportError as e:
    print(f"ERROR: Cannot import hvac_field_memory: {e}")
    print("Make sure POSTGRES_* and QDRANT_* env vars are set")
    sys.exit(1)

# First case: Daikin VRV U4-01 VEE field technique
case_data = {
    "author": "willrefrimix",
    "source_type": "field_experience",
    "source_url": None,
    "source_title": "Daikin VRV U4-01 VEE Diagnostic Technique",
    "brand": "Daikin",
    "model": "VRV",
    "model_family": "VRV",
    "equipment_type": "VRF/VRV",
    "alarm_codes": ["U4-01"],
    "components": ["VEE", "unidade_interna", "linha_liquido", "comunicacao"],
    "symptoms": ["sistema_sucateado", "multiplas_internas", "vee_suspeita", "sem_service_check"],
    "problem_summary": "Sistema VRV com 43 unidades internas, suspeita de 5 VEEs danificadas, display sete segmentos limitado, sem service check disponivel.",
    "field_technique": "Quando nao ha service check disponivel, usar comportamento termico e resposta das unidades apos carga forcada/desligamento para identificar VEE travada aberta ou unidade que continua permitindo passagem de fluido. Forcar operacao de forma controlada, desligar o sistema, observar quais unidades continuam com linha fria/condensacao ou passagem de fluido fora do padrao. Cruzar esse comportamento com enderecamento/unidades que aparecem ou deixam de aparecer no display.",
    "safety_notes": "Nao medir placa energizada sem procedimento oficial. Nao cravar troca de placa sem isolar comunicacao, VEE e comportamento frigorifico. Cuidado com alta tensao, fluido refrigerante e componentes inverter.",
    "limitations": "E experiencia de campo, nao substitui procedimento oficial do manual.",
    "evidence_level": "field_experience",
    "confidence": "medium",
    "status": "draft",
    "metadata": {"created_from": "chat/openwebui", "original_author": "@willrefrimix"}
}

print("1. Inserting case into Postgres...")
case_id = insert_field_case(case_data)
print(f"   Inserted: {case_id}")

print("2. Approving case...")
approve_field_case(case_id)
print(f"   Approved: {case_id}")

print("3. Indexing to Qdrant hvac_field_experience_v1...")
index_field_case_approved(case_id)
print(f"   Indexed: {case_id}")

print("")
print("=== Seed Complete ===")
print(f"Case ID: {case_id}")
print("Next: Test with query 'Daikin VRV U4-01 VEE' in OpenWebUI")
PYTHON
