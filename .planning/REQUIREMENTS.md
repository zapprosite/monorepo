# Requisitos Funcionais - Brasil IDEIAS 05/2026

## RF1: Engine de Evidências (Proof-first)
- A cada resposta técnica, a IA deve indicar a página e o parágrafo do manual utilizado.
- Sistema deve suportar exibição de diagramas elétricos extraídos diretamente do PDF.

## RF2: Filtro de Hardware Especializado
- Validação mandante: Se o modelo não for Inverter, o sistema deve recusar o atendimento e indicar que é especialista apenas em tecnologia Inverter.

## RF3: Refinamento de Contexto
- Uso de embeddings de alta densidade para tabelas de códigos de erro, garantindo que o mapeamento de piscadas de LED/códigos hexadecimais seja infalível.

# Requisitos Não-Funcionais
- Latência: Resposta inicial com evidência em menos de 5 segundos (via Cache Redis).
- Precisão: 99.9% de conformidade com o manual técnico.
