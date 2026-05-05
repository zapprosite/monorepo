# Requisitos - Brasil IDEIAS 05/2026

## RF1: Engine de Evidências Proof-First
- Toda resposta técnica deve ser baseada em manual, família documentada, grafo técnico ou fallback explicitamente rotulado.
- Valores técnicos específicos só podem aparecer com evidência `manual_exact` ou `manual_family`.
- Citações devem preservar manual, página/seção/chunk quando disponível.

## RF2: Filtro de Hardware Especializado
- O sistema atende exclusivamente ar-condicionado inverter, VRV/VRF e velocidade variável no Brasil.
- Intake deve rejeitar convencional/fixo, janela, portátil, R-22/Freon e documentos explicitamente não inverter.

## RF3: Qualidade de Documento
- Aceitar apenas service manual, manual técnico, troubleshooting, error code, wiring diagram e installation manual técnico.
- Rejeitar catálogo comercial, folder, brochure, garantia, nota fiscal, controle remoto isolado e manual de usuário simples.
- Manuais confirmadamente não PT-BR devem ir para rejeição/pending review, preservando bilíngues PT+EN.

## RF4: OpenWebUI Strict-Only
- OpenWebUI HVAC deve expor exatamente um modelo: `hvac-manual-strict`.
- É proibido recriar modelos, aliases ou funções legadas no OpenWebUI.
- A tabela `model` deve conter apenas `hvac-manual-strict`; a tabela `function` deve ficar vazia salvo SPEC futuro explícito.

## RF5: Expansão de Base
- Catálogo INMETRO deve ser sincronizado e normalizado em JSONL.
- Coverage deve indicar por marca: modelos INMETRO, indexados, faltantes, percentual, tier e suporte de scraper.
- Marcas sem scraper automático devem gerar `pending_review.jsonl`.

## RF6: Aquisição Automática de Manuais
- O sistema deve transformar lacunas de coverage em candidatos de download.
- Busca deve priorizar fontes oficiais de fabricante e páginas de suporte.
- URLs candidatas devem ser ranqueadas, baixadas, validadas como PDF e enviadas ao intake.
- Falhas de aquisição devem ser registradas em `pending_review.jsonl` com motivo rastreável.

# Requisitos Não Funcionais

- Segurança: secrets via env; nunca logar tokens ou chaves.
- Confiabilidade: pipeline batch precisa de checkpoint e retomada segura.
- Latência: resposta inicial com evidência em até 5s quando Qdrant/LLM estiverem saudáveis.
- Precisão: bloquear alucinação técnica e medição energizada sem respaldo de manual.
- Operação: todo estado de infra relevante deve ser refletido em `homelab-context`.
