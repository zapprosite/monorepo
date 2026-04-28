#!/usr/bin/env python3
"""
HVAC Guided Responses — Respostas guiadas por família de erro/código

Gera textos de triagem guiada para combinações comuns de:
- Marca + Família (VRV/VRF) + Código de erro

Evita:
- "compressor protection trip"
- Valores elétricos/pressão exatos sem manual
"""

import re
from typing import Optional

# Padrão para extrair código de erro principal e subcódigo
ERROR_CODE_PATTERNS = re.compile(
    r'\b(E\d{1,4}|A\d{1,4}|F\d{1,4}|U\d{1,4}|L\d{1,4}|P\d{1,4}|C\d{1,4}|d\d{1,4}|'
    r'Y\d{1,4}|J\d{1,4})\b',
    re.IGNORECASE
)


def extract_error_info(query: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extrai código de erro principal e subcódigo de uma query.

    Returns:
        (main_code, subcode) ex: ("E4", "01") ou ("E4", None)
    """
    error_codes = ERROR_CODE_PATTERNS.findall(query)
    main_code = error_codes[0] if error_codes else None

    if not main_code:
        return None, None

    # Tentar extrair subcódigo (ex: E4-01, E4_001, E401)
    subcode_match = re.search(r'E4[-_]?(\d+)', query, re.IGNORECASE)
    subcode = subcode_match.group(1) if subcode_match else None

    return main_code.upper(), subcode


def is_vrv_family(query: str) -> bool:
    """Detecta se query menciona VRV ou VRF."""
    q_lower = query.lower()
    return any(f in q_lower for f in ["vrv", "vrf"])


def is_brand(query: str, brand: str) -> bool:
    """Detecta se query menciona uma marca específica."""
    return brand.lower() in query.lower()


# =============================================================================
# Respostas Guiadas por Família de Erro
# =============================================================================

def build_daikin_vrv_e4_guide(query: str) -> Optional[str]:
    """
    Gera resposta guiada para E4 em Daikin VRV/VRF.

    E4 = família de baixa pressão:
    - E4-01/E4-001 = provável baixa pressão na Master
    - E4-02/E4-002 = variação por unidade Slave
    - E4-03/E4-003 = outra variação Slave

    NÃO usa "compressor protection trip".
    NÃO dá valores elétricos/pressão exatos sem manual.
    """
    if not is_vrv_family(query):
        return None
    if not is_brand(query, "daikin"):
        return None

    main_code, subcode = extract_error_info(query)

    if main_code != "E4":
        return None

    sections = []

    sections.append("""⚠️ TRIAGEM GUIADA — Daikin VRV/VRF | Código E4

Você encontrou o código E4 no sistema VRV da Daikin.

**O que significa E4 em Daikin VRV:**
E4 é uma *família* de erros que, no sistema VRV/VRF da Daikin, geralmente aponta para **baixa pressão** no circuito de refrigerante.

**Importante:** O significado exato depende do subcódigo. Os mais comuns são:
- **E4-01 / E4-001** → Provável baixa pressão na unidade Master (principal)
- **E4-02 / E4-002** → Variação por unidade interna/slave
- **E4-03 / E4-003** → Outra variação slave
""")

    # Se tem subcódigo, dar direcionamento específico
    if subcode:
        sections.append(f"""**Sobre o subcódigo E4-{subcode}:**

Você já tem o subcódigo, isso ajuda no diagnóstico:
- O subcódigo indica *qual unidade* está reportando o erro
- Anote o subcódigo completo (ex: E4-01) para buscar no manual específico

**Próximo passo:**
1. Identifique a unidade que está apresentando o erro (Master ou qual Slave)
2. Verifique o subcódigo no display da unidade externa ou no histórico de erros
3. Com o subcódigo em mãos, posso buscar o procedimento específico no manual
""")
    else:
        sections.append("""**Próximo passo:**
Confirme o subcódigo completo no display da unidade externa ou no manual.
O subcódigo aparece como E4-XX (ex: E4-01, E4-001).

Sem o subcódigo, consigo dar apenas uma orientação geral de triagem.
""")

    sections.append("""** Orientações gerais de triagem para E4 = baixa pressão:**

1. Verificar se há vazamento visível de gás refrigerante nas tubulações
2. Confirmar se a carga de gás está dentro da especificação (consultar manual)
3. Verificar obstruções no circuito de refrigerante
4. Checar funcionamento do compressor (ruído anormal, calor excessivo)
5. Avaliar condições de carga térmica (temperatura ambiente, ocupação do ambiente)

⚠️ Não faça medições de pressão ou intervenções no circuito de gás
   sem respaldo explícito do manual do modelo específico.
""")

    return "\n\n".join(sections)


def build_guided_response(query: str) -> Optional[str]:
    """
    Detecta tipo de query e retorna resposta guiada apropriada.

    Returns:
        Texto de triagem guiada se encontrou match, None caso contrário.
    """
    # Daikin VRV + E4
    guide = build_daikin_vrv_e4_guide(query)
    if guide:
        return guide

    # Futuras famílias de erro podem ser adicionadas aqui:
    # - build_mitsubishi_vrf_e8_guide(query)
    # - build_carrier_vrv_f5_guide(query)
    # etc.

    return None


# =============================================================================
# CLI Interface
# =============================================================================

if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Uso: python3 hvac-guided-responses.py <query>", file=sys.stderr)
        print("Exemplo: python3 hvac-guided-responses.py 'erro e4 vrv daikin'", file=sys.stderr)
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    response = build_guided_response(query)

    if response:
        print(response)
    else:
        print("[Nenhuma resposta guiada disponível para esta combinação]")
