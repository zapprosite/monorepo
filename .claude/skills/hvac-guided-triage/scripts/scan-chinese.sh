#!/usr/bin/env bash
#
# scan-chinese.sh
# Verifica que não há caracteres chineses em código, docs ou comments.
# Exceções: vrv系統/vrf系統/vrv系统 (termos técnicos)
# Uso: bash scan-chinese.sh [path]
#

set -euo pipefail

TARGET="${1:-.}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FOUND=0
SKIPPED=0

# Chinese Unicode ranges (common + extension)
CHINESE_PATTERN='[一-鿿㐀-䶿𠀀-𯟿]'

echo "=== Scan de Caracteres Chineses ==="
echo "Target: $TARGET"
echo ""

# Scan source files
while IFS= read -r -d '' file; do
    # Skip binary files
    if file "$file" | grep -q "binary"; then
        continue
    fi

    # Check for Chinese characters
    if grep -Pl "$CHINESE_PATTERN" "$file" 2>/dev/null; then
        # Check each match
        FILE_HAS_BAD=false
        while IFS= read -r line; do
            LINENUM=$(echo "$line" | cut -d: -f1)
            CONTEXT=$(echo "$line" | cut -d: -f2-)

            # Whitelist check — only these exact terms are allowed
            # Also allow:
            # - CHINESE_PATTERN definition in this script
            # - language-standard.md line that documents the prohibition rule with Unicode ranges
            if echo "$CONTEXT" | grep -qE "vrv系統|vrf系統|vrv系统|CHINESE_PATTERN=|REGRA.*chino.*ranges"; then
                echo -e "${YELLOW}⚠️  Exceção técnica: $file:$LINENUM${NC}"
                SKIPPED=$((SKIPPED + 1))
            else
                echo -e "${RED}❌ Encontrado: $file:$LINENUM${NC}"
                echo "   $CONTEXT" | head -c 80
                FILE_HAS_BAD=true
            fi
        done < <(grep -Pn "$CHINESE_PATTERN" "$file" 2>/dev/null)

        [[ "$FILE_HAS_BAD" == "true" ]] && FOUND=$((FOUND + 1))
    fi
done < <(find "$TARGET" \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.sh" -o -name "*.md" -o -name "*.rules" \) -type f -not \( -path "*/node_modules/*" -o -path "*/.bun/*" -o -path "*/archive/*" -o -path "*/obsidian/*" \) -print0 2>/dev/null)

echo ""
if [[ $FOUND -eq 0 ]]; then
    echo -e "${GREEN}✅ Nenhum caractere chinês não autorizado${NC}"
    [[ $SKIPPED -gt 0 ]] && echo -e "${YELLOW}   ($SKIPPED exceções técnicas permitidas)${NC}"
    exit 0
else
    echo -e "${RED}❌ $FOUND arquivos com caracteres chineses fora da whitelist${NC}"
    exit 1
fi
