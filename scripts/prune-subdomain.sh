#!/bin/bash
#===========================================
# Prune Severo — Remoção completa de subdomain
# Usage: ./prune-subdomain.sh <subdomain> [--dry-run]
# Exemplo: ./prune-subdomain.sh grafana
#          ./prune-subdomain.sh bot --dry-run
#===========================================
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <subdomain> [--dry-run]"
  echo "Example: $0 grafana.zappro.site"
  echo "         $0 bot"
  exit 1
fi

SUBDOMAIN="$1"
DRY_RUN=false
if [[ "${2:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# Normalize: strip .zappro.site suffix if provided
NAME="${SUBDOMAIN%.zappro.site}"
DOMAIN="${NAME}.zappro.site"

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}=== PRUNE SEVERO: ${DOMAIN} ===${NC}"
[[ "$DRY_RUN" == true ]] && echo -e "${YELLOW}[DRY RUN - sem alterações reais]${NC}"

#===========================================
# PASSO 1: Scan for ALL references
#===========================================
echo -e "\n${YELLOW}[1/5] Scan de referências em todo o monorepo...${NC}"

SCAN_DIR="${2:-/srv/monorepo}"
mapfile -t FILES_WITH_REF < <(grep -rls --include="*.sh" --include="*.tf" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.ts" --include="*.js" --include="*.py" --include="*.txt" "${DOMAIN}" "/srv/monorepo" 2>/dev/null | grep -v ".git/" | grep -v "node_modules/" | sort)

echo "Referências encontradas em ${#FILES_WITH_REF[@]} ficheiros:"

#===========================================
# PASSO 2: Remove from Terraform variables.tf
#===========================================
echo -e "\n${YELLOW}[2/5] Removendo de Terraform...${NC}"

TF_VARS="/srv/ops/terraform/cloudflare/variables.tf"
if [[ -f "$TF_VARS" ]] && grep -q "${NAME} = {" "$TF_VARS"; then
  echo "  → $TF_VARS"
  if [[ "$DRY_RUN" == false ]]; then
    awk -v name="${NAME}" '
    BEGIN { in_block=0; brace_count=0 }
    /^[ \t]*'"${NAME}"'[ \t]*=/ { in_block=1; brace_count=0 }
    in_block == 1 {
      gsub(/[ \t]+$/, "")
      if (/\{/) { brace_count += gsub(/\{/, "&") }
      if (/\}/) { brace_count -= gsub(/\}/, "&") }
      if (brace_count == 0 && /^\}/) {
        in_block = 0
        next
      }
      if (in_block == 1) next
    }
    { print }
    ' "$TF_VARS" > "${TF_VARS}.tmp" && mv "${TF_VARS}.tmp" "${TF_VARS}"
    echo "    ✅ Removed ${NAME} service block"
  else
    echo "    [DRY RUN] Would remove ${NAME} service block"
  fi
fi

#===========================================
# PASSO 3: Saltar docs de governance (NÃO REMOVER entries PRUNED)
#===========================================
echo -e "\n${YELLOW}[3/5] Saltando docs de governance...${NC}"
echo "  → Ghost entries são preservadas no SUBDOMAINS.md como PRUNED"

#===========================================
# PASSO 4: Remove from skills, scripts, code (skip governance)
#===========================================
echo -e "\n${YELLOW}[4/5] Removendo de skills e código...${NC}"

for f in "${FILES_WITH_REF[@]}"; do
  # Skip terraform state, binary files, and governance docs
  if [[ "$f" == *.tfstate* ]] || [[ "$f" == *.jsonl ]] || \
     [[ "$f" == *"/ai-governance/"* ]] || [[ "$f" == *"/docs/GOVERNANCE/"* ]] || \
     [[ "$f" == *"/ops/ai-governance/"* ]]; then
    continue
  fi

  if grep -q "${DOMAIN}" "$f" 2>/dev/null; then
    echo "  → $f"
    if [[ "$DRY_RUN" == false ]]; then
      grep -v "${DOMAIN}" "$f" > "${f}.tmp" && mv "${f}.tmp" "${f}"
      echo "    ✅ Removed reference"
    else
      echo "    [DRY RUN] Would remove ${DOMAIN} from $f"
    fi
  fi
done

#===========================================
# PASSO 5: DNS/Tunnel via Terraform state
#===========================================
echo -e "\n${YELLOW}[5/5] Removendo DNS CNAME do Terraform state...${NC}"

TF_DIR="/srv/ops/terraform/cloudflare"
if [[ -d "$TF_DIR" ]]; then
  if terraform -chdir="$TF_DIR" state list 2>/dev/null | grep -q "cloudflare_record.tunnel_cname.*${NAME}"; then
    echo "  → CNAME existe no state..."
    if [[ "$DRY_RUN" == false ]]; then
      terraform -chdir="$TF_DIR" state rm "cloudflare_record.tunnel_cname[\"${NAME}\"]" 2>/dev/null && echo "    ✅ CNAME removido" || echo "    ⚠️  Erro"
    else
      echo "    [DRY RUN] Would remove CNAME from state"
    fi
  else
    echo "  → CNAME não existe no state"
  fi

  if terraform -chdir="$TF_DIR" state list 2>/dev/null | grep -q "cloudflare_zero_trust_access_application.services.*${NAME}"; then
    echo "  → Access App existe no state..."
    if [[ "$DRY_RUN" == false ]]; then
      terraform -chdir="$TF_DIR" state rm "cloudflare_zero_trust_access_application.services[\"${NAME}\"]" 2>/dev/null && echo "    ✅ Access App removido" || echo "    ⚠️  Erro"
      terraform -chdir="$TF_DIR" state rm "cloudflare_zero_trust_access_policy.owners[\"${NAME}\"]" 2>/dev/null && echo "    ✅ Access Policy removida" || echo "    ⚠️  Erro"
    else
      echo "    [DRY RUN] Would remove Access resources"
    fi
  fi
fi

#===========================================
# SUMMARY
#===========================================
echo -e "\n${GREEN}=== PRUNE COMPLETO ===${NC}"
[[ "$DRY_RUN" == true ]] && echo -e "${YELLOW}[DRY RUN]${NC}"
echo "Domínio: ${DOMAIN}"
echo "Ficheiros varridos: ${#FILES_WITH_REF[@]}"
echo ""
echo "✅ Tudo gerido via terraform CLI (token cfut_ = Zone:DNS + Tunnel)"
echo ""
echo "✅ Próximo passo: cd /srv/ops/terraform/cloudflare && terraform plan"
