package agents

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
)

// TechnicalRule represents a rule for HVAC technical support.
type TechnicalRule struct {
	Keywords      []string // palavras que disparam a regra
	Responses    []string // respostas disponíveis
	BrandFilter  []string // marca específica (opcional)
	ErrorCodes   []string // códigos de erro específicos
	Priority     int      // prioridade da regra (maior = mais específico)
}

// RulesResponseAgent is a rules-based chatbot for HVAC technical support.
// Uses pattern matching to find the best response without AI.
type RulesResponseAgent struct {
	rules []TechnicalRule
}

// NewRulesResponseAgent creates a new rules-based response agent.
func NewRulesResponseAgent() *RulesResponseAgent {
	return &RulesResponseAgent{
		rules: loadHVACRules(),
	}
}

// loadHVACRules loads the HVAC technical support rules in Brazilian Portuguese.
func loadHVACRules() []TechnicalRule {
	return []TechnicalRule{
		// ===== DIAGNÓSTICO SEQUENCIAL (FLUXO PRINCIPAL) =====
		{
			Keywords: []string{"não liga", "não funciona", "sem energia", "aparelho morto", "unidade morta"},
			Responses: []string{
				"Fluxo de diagnóstico SE unidade NÃO LIGA: 1) Verificar disjuntor do quadro (desarmado = curto na fiação). 2) Verificar tomada com multímetro (deve ter 220V). 3) Testar capacitor com ESR meter (degradado = sem partida). 4) Testar placa eletrônica (fusível queimado, tensões 5V/12V ausentes). Comece pelo mais simples: disjuntor e tomada.",
				"Unidade sem energia - diagnóstico em 4 passos: 1) Disjuntor desarmado = curto ou sobrecarga na instalação. 2) Tomada sem tensão = problema no quadro elétrico. 3) Capacitor com ESR >3x normal = substituir. 4) Placa sem 5V/12V = fonte com defeito. Se não sabe usar multímetro, chame elétrico primeiro.",
			},
			Priority: 12,
		},
		{
			Keywords: []string{"diagnóstico", "diagnostico", "fluxo", "passo a passo", "onde começar", "como diagnosticar", "árvore de decisão"},
			Responses: []string{
				"Fluxo universal de diagnóstico HVAC: 1) ENTREVISTA: qual sintoma? (não gela, barulho, desliga). 2) VISUAL: filtro sujo? Vazamento de água? LEDs? 3) ELÉTRICA: tensão, capacitor, conexões. 4) PRESSÕES: manifold (alta e baixa). 5) COMPONENTES: sensor, placa, compressor. Siga esta ordem - evita diagnosticar errado.",
				"Regra de ouro do diagnóstico: sempre comece pela causa mais comum. 80% dos problemas são: filtro sujo, capacitor degradado, ou falta de gás. Só investigue causas complexas depois de eliminar as simples. Exemplo: se não gela, limpe o filtro ANTES de medir pressões.",
			},
			Priority: 8,
		},
		{
			Keywords: []string{"unidade não resfria", "não gela", "quente", "definitivo", "nivel de servicio"},
			Responses: []string{
				"Fluxo completo quando NÃO RESFRIA: 1) Filtro limpo? (causa #1). 2) Verificar pressões com manifold: Alta e Baixa. 3) R-410A normal: Alta 250-400 PSI, Baixa 130-180 PSI. 4) Alta ALTA + Baixa BAIXA = compressor falhando. 5) Alta BAIXA + Baixa BAIXA = falta de gás. 6) Alta NORMAL + Baixa BAIXA = vazamento interno.",
				"Primeira verificação de Split que não gela: MEDIR PRESSÕES. Com manifold conectado, opere em modo frio. R-410A: Alta 250-400 PSI, Baixa 130-180 PSI. Se Alta ALTA e Baixa BAIXA = compressor com problema mecânico (válvulas). Se Ambas BAIXAS = vazamento de gás. Se Ambas ALTAS = excesso de gás.",
			},
			Priority: 12,
		},
		// ===== SUPERHEAT E SUBCOOLING =====
		{
			Keywords: []string{"superheat", "subcooling", "superaquecimento", "subresfriamento", "super heating", "sub cooling"},
			Responses: []string{
				"Superheat = calor acima do ponto de ebulição na sucção. Normal: 8-15°F (5-8°C). SUPERHEAT ALTO (>15°F) = falta de gás OU restrição no circuito. SUPERHEAT BAIXO (<5°F) = excesso de gás ou problema na válvula de expansão.",
				"Subcooling = calor abaixo do ponto de condensação na descarga. Normal: 8-14°F (5-8°C). SUBCOOLING ALTO (>14°F) = excesso de gás. SUBCOOLING BAIXO (<8°F) = falta de gás. Para medir: use termômetro na tubulação de descarga e consulte tabela de saturação.",
			},
			Priority: 10,
		},
		// ===== CÓDIGOS DE ERRO POR MARCA (EXPANDIDO) =====
		{
			Keywords: []string{"erro e0", "codigo e0", "falha e0", "e0", "e00", "sem comunicação"},
			Responses: []string{
				"E00 ou E0: Sem comunicação entre unidade interna e externa (Split Inverter). Causas: cabo de comunicação interrompido, conector solto, ou placa de alguma das unidades com problema. Verifique visualmente os fios entre as unidades. Se fio estiver OK, provavelmente é placa.",
			},
			ErrorCodes: []string{"e0", "e00", "erro e0"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e1", "codigo e1", "falha e1", "e1"},
			Responses: []string{
				"E1: Erro no sensor de temperatura ambiente (unidade interna). Solução: resetar (desligar 5 min). Se persistir, sensor NTC 10kΩ@25°C com defeito - substituir. Springer/Midea: sensor desconectado ou aberto. LG: anomalia no sensor de temperatura ambiente.",
				"E1 significa problema no sensor de temperatura. NTC ambiente típico: 10kΩ@25°C. Teste: desconecte um terminal, meça resistência. Se >20% fora da curva normal, substituir.",
			},
			ErrorCodes: []string{"e1", "erro e1"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e2", "codigo e2", "falha e2", "e2"},
			Responses: []string{
				"E2: Sensor de temperatura da evaporadora (unidade interna) com problema. Springer/Midea: sensor de temperatura do evaporador aberto/curto. LG: anomalia no sensor de temperatura do evaporador. Daikin: erro no sensor de temperatura de sucção. Verifique conector e resistência do sensor.",
				"E2 = problema no sensor da evaporadora. O que fazer: 1) Resetar o aparelho. 2) Verificar conexão do sensor. 3) Medir resistência do NTC (deveria ser ~10kΩ@25°C, varia com temperatura). Sensor fora da curva = substituir.",
			},
			ErrorCodes: []string{"e2", "erro e2"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e3", "codigo e3", "falha e3", "e3"},
			Responses: []string{
				"E3: Pode significar coisas diferentes según a marca: Springer/Midea = sensor do condensador (unidade externa). LG = sensor de temperatura do condensador. Daikin = erro no sensor de temperatura de descarga do compressor. Este sensor protege contra superaquecimento - problema sério se falhar.",
				"E3 é sério porque envolve o sensor do condensador ou descarga. Função: proteger o compressor de temperatura excessiva. Se aparecer E3: verifique se a unidade externa está ventilada, serpentina limpa, e se o ventilador funciona. Se tudo OK, sensor com defeito.",
			},
			ErrorCodes: []string{"e3", "erro e3"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e4", "codigo e4", "falha e4", "e4"},
			Responses: []string{
				"E4: Springer/Midea = sensor de temperatura do compressor. LG = sensor de temperatura do compressor. Daikin = pode indicar erro no sensor de temperatura ambiente. Sensor crítico para proteção térmica do compressor - não ignore este erro.",
				"E4 = sensor do compressor. Sintomas associados: compressor ligando e desligando, superaquecimento, ou recém-instalado com carga incorreta. Verifique também: pressão de gás, ventilação da unidade externa, e se o capacitor está OK.",
			},
			ErrorCodes: []string{"e4", "erro e4"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e5", "codigo e5", "falha e5", "e5"},
			Responses: []string{
				"E5: Springer/Midea = proteção de ALTA PRESSÃO. LG = proteção de alta pressão (High Pressure Switch). Daikin = proteção de alta pressão. CAUSA COMUM: condensador sujo, ventilador fraco, excesso de gás, ou temperatura externa muito alta. Limpe a unidade externa primeiro.",
				"E5 = proteção de alta pressão ativada. Primeira ação: limpar o condensador (unidade externa) com escova. Se não resolver, verificar: 1) Ventilador funciona? 2) Carga de gás correta? 3) Pressão realmente alta no manifold? Em dias muito quentes, é normal temporariamente.",
			},
			ErrorCodes: []string{"e5", "erro e5"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e6", "codigo e6", "falha e6", "e6"},
			Responses: []string{
				"E6: Springer/Midea = proteção de BAIXA PRESSÃO. LG = proteção de baixa pressão (Low Pressure Switch). IMPORTANTE: baixa pressão pode indicar falta de gás, obstrução no circuito, ou vácuo no sistema (ar dentro). NÃO simplesmente recarregar - encontre o vazamento primeiro.",
				"E6 = pressão baixa demais. Isso é sério: pode ser vazamento de gás, umidade no sistema, ou obstrução. Se aparecer E6, não continue usando - pode danificar o compressor. Técnico deve: detectar vazamento, reparar, fazer vácuo, recarregar.",
			},
			ErrorCodes: []string{"e6", "erro e6"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e7", "codigo e7", "falha e7", "e7"},
			Responses: []string{
				"E7: Springer/Midea = proteção de SOBRECARGA do compressor. LG = proteção de sobrecarga do compressor. Possível: capacitor degradado, tensão elétrica errada, problema mecânico no compressor, ou superaquecimento. Medir corrente do compressor com alicate amperímetro.",
			},
			ErrorCodes: []string{"e7", "erro e7"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e8", "codigo e8", "falha e8", "e8", "ipm", "variador"},
			Responses: []string{
				"E8: FALHA NO VARIADOR / IPM (Intelligent Power Module). Este é o drive que controla o compressor Inverter. Sintomas: compressor não funciona, não varia velocidade, ou desliga após alguns minutos. IPM é caro - antes de substituir, verificar: conexões, dissipador de calor com pasta térmica, e se o problema não é no compressor.",
				"E8 em Split Inverter = problema no módulo IPM ou variador. IPM controla a frequência do compressor. Sintomas comuns: motor não parte, ou funciona em velocidade fixa. Antes de trocar IPM: 1) Descarregar capacitors (300-400V podem matar!). 2) Medir resistência U-V-W do compressor. 3) Verificar se há curto no IPM (multímetro modo diodo).",
			},
			ErrorCodes: []string{"e8", "erro e8"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e9", "codigo e9", "falha e9", "e9", "compressor não parte"},
			Responses: []string{
				"E9: Springer/Midea = proteção de temperatura do compressor. LG = proteção de temperatura do compressor. Daikin = proteção do variador/inversor. Pode indicar: carga de gás incorreta, problema no capacitor, ou umidade. Aguarde resfriar e tente novamente. Se recorrente, investigação necessária.",
				"E9 = compressor superaquecendo. Causas: 1) Excesso de gás (subcooling alto). 2) Falta de gás (superaquecimento do cilindro). 3) Capacitor fraco (partida difícil). 4) Ventilação ruim da unidade externa. Agentes externos quentes (>40°C) também causam. Limpe o condensador e aguarde 30 min.",
			},
			ErrorCodes: []string{"e9", "erro e9"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro f0", "codigo f0", "falha f0", "f0", "vfd"},
			Responses: []string{
				"F0: Carrier = erro no Variador (VFD). Este código indica falha no drive de frequência que controla o compressor Inverter. A peça é cara (R$ 800-1800). Antes de substituir: verificar tensão de entrada, conexões do módulo IPM, e se o problema não é capacitador degradado no barramento DC.",
			},
			ErrorCodes: []string{"f0", "erro f0"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro p1", "codigo p1", "falha p1", "p1", "tensão"},
			Responses: []string{
				"P1: Midea = proteção de tensão de alimentação instável (under-voltage/over-voltage). Verifique: 1) Tensão da tomada com multímetro (deveria ser 220V ±10%). 2) Se há outros aparelhos puxando muita corrente da mesma fase. 3) Conexões elétricas soltas. 4) Capacitor de filtro da placa principal degradado.",
				"P1 = problema na alimentação elétrica. O ar condicionado Inverter é sensível a variações de tensão. Soluções: 1) Verificar tensão real com multímetro. 2) Se instável na região, considerar usar estabilizador ou UPS específico para HVAC. 3) Descartar capacitor de filtro na placa.",
			},
			ErrorCodes: []string{"p1", "erro p1"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro p2", "codigo p2", "falha p2", "p2", "módulo ipm"},
			Responses: []string{
				"P2: Midea = proteção de temperatura do módulo IPM (Intelligent Power Module). O IPM está superaquecendo. Causas: 1) Pasta térmica seca entre IPM e dissipador. 2) Ventilação inadequada da placa. 3) Carga excessiva no compressor. 4) IPM com defeito. Desligue e aguarde resfriar. Se recorrente, revisão da placa necessária.",
			},
			ErrorCodes: []string{"p2", "erro p2"},
			Priority: 15,
		},
		// ===== TESTE DE COMPONENTES ELETRÔNICOS =====
		{
			Keywords: []string{"testar ipm", "módulo de potência", "intelligent power module", "驱动"},
			Responses: []string{
				"⚠️ ANTES DE TESTAR IPM: Descarregar capacitors (30 MINUTOS após desligar). USAR RESISTOR 10kΩ/5W entre P(+) e N(-). COMO TESTAR: Multímetro modo diodo. P→N: 0.3-0.7V (reversa = ∞). U→N, V→N, W→N: mesmo teste. CURTO (0V ambas) ou ABERTO (∞ ambas) = IPM COM DEFEITO → SUBSTITUIR.",
				"Teste de IPM passo a passo: 1) Descarregar barramento DC (resistor 10kΩ/5W por 30 seg). 2) Configurar multímetro em modo DIODO. 3) Testar cada diodo interno: P→N, U→N, V→N, W→N. 4) Leitura 0.3-0.7V = OK. 5) Se 0V ou ∞ em qualquer direção = IPM queimado. Resistência entre fases U-V, V-W, W-U deve ser 500Ω-5kΩ.",
			},
			Priority: 12,
		},
		{
			Keywords: []string{"testar compressor", "compressor não funciona", "resistência bobina", "rotativo", "scroll"},
			Responses: []string{
				"Teste de compressor Inverter (resistência U-V-W): Rotativo 9k BTU: 3.2-4.5Ω. Rotativo 12k BTU: 2.5-3.5Ω. Scroll 18k BTU: 1.8-2.5Ω. Scroll 24k BTU: 1.2-1.8Ω. Scroll 36k BTU: 0.8-1.3Ω. Desequilíbrio >5% entre fases = problema. Curto (<1Ω) ou Aberto (>10Ω) = compressor com defeito.",
				"Como testar compressor: 1) Desligar e esperar 15 min (descarga). 2) Isolar fios do bloco de terminais. 3) Medir resistência entre cada par (U-V, V-W, W-U). 4) Valores devem ser iguais entre fases (±5%). 5) Testar cada fase contra massa (isolamento >20MΩ = bom). 6) Se tudo OK, problema está no drive/IPM.",
			},
			Priority: 12,
		},
		{
			Keywords: []string{"testar ntc", "sensor temperatura", "termistor", "resistência sensor"},
			Responses: []string{
				"Teste de NTC (sensor de temperatura): NTC 10kΩ@25°C padrão: 0°C = ~32kΩ, 25°C = 10kΩ, 40°C = ~5.6kΩ, 60°C = ~2.8kΩ. COMO TESTAR: Desconectar um terminal → medir resistência → comparar com tabela. Desvio >20% = SUBSTITUIR. Curto (0Ω) ou Aberto (∞) = SUBSTITUIR.",
				"NTC é resistor que varia com temperatura (coeficiente negativo). Valores típicos por posição: Temperatura ambiente: 10kΩ@25°C. Evaporador: 10kΩ@25°C B=3950. Descarga compressor: 50kΩ ou 100kΩ. Para testar: usar ferro de solda para aquecer suavemente e observar resistência cair - se não mudar, está com defeito.",
			},
			Priority: 10,
		},
		{
			Keywords: []string{"testar capacitor", "capacitor degradado", "esr", "capacitor estufado"},
			Responses: []string{
				"Teste de capacitor com ESR METER (mais confiável que multímetro): Filtro DC Link 470μF/400V: ESR bom <0.3Ω. Filtro 100μF/400V: ESR bom <0.5Ω. Capacitor partida 35μF/450V: ESR bom <0.3Ω. ESR >3x valor bom = DEGRADADO → SUBSTITUIR. Capacitância <80% nominal = SUBSTITUIR. Visual estufado/ventilado = SUBSTITUIR.",
				"⚠️ CAPACITOR MATA — mesmo com equipamento desligado. Barramento DC: 300-400V por 30 MINUTOS após desligar. PROCEDIMENTO: 1) Desligar disjuntor. 2) AGUARDAR 15-30 MINUTOS. 3) Usar resistor 10kΩ/5W entre terminais por 10 segundos. 4) Medir tensão → 0V antes de tocar. NUNCA usar fio nu ou resistor <5W.",
			},
			Priority: 12,
		},
		// ===== SEGURANÇA REFRIGERANTES =====
		{
			Keywords: []string{"r-32", "refrigerante inflamável", "a2l", "r32", "flamável"},
			Responses: []string{
				"⚠️ R-32 É INFLAMÁVEL (classe A2L). Regras de segurança: 1) Detector de vazamento A2L é OBRIGATÓRIO. 2) Ventilação mínima 10 volumes/hora em ambientes fechados. 3) Afastar fontes de ignição (raio 3 metros). 4) NUNCA soldar com carga de R-32 dentro do ambiente. 5) EPI: luvas anti-estáticas, óculos, calçado condutivo. 6) Cilindro errado = PROIBIDO (R-32 ≠ R-410A).",
				"R-32 (A2L) procedimentos obrigatórios: Antes de manutenção em área fechada: medir concentração com detector A2L (deve ser <1%). Se >3% = EVACUAR e chamar bombeiros. R-32 tem GWP=675 (77% menor que R-410A) - mais ecológico, mas requer respeito. LFL: 13.4% em volume.",
			},
			Priority: 15,
		},
		{
			Keywords: []string{"r-410a", "pressões r410a", "r410a", "r-22", "zeotrópica"},
			Responses: []string{
				"R-410A é mistura zeotrópica (50% R-32 + 50% R-125), NÃO inflamável (classe A1). Pressões típicas: 25°C: Alta 270-304 PSI, Baixa 145-170 PSI. 30°C: Alta 310-341 PSI, Baixa 155-185 PSI. 35°C: Alta 355-382 PSI, Baixa 168-200 PSI. Pressão crítica: 798 PSI. R-22 está em eliminação (proibido desde 2015 para equipamentos novos).",
				"Valores de referência R-410A por capacidade: 9k BTU: Alta 115-135 PSI, Baixa 65-75 PSI. 12k BTU: Alta 125-150 PSI, Baixa 68-80 PSI. 18k BTU: Alta 140-175 PSI, Baixa 70-85 PSI. 24k BTU: Alta 150-200 PSI, Baixa 72-90 PSI. 36k BTU: Alta 175-225 PSI, Baixa 75-95 PSI.",
			},
			Priority: 10,
		},
		{
			Keywords: []string{"brazagem", "soldar", "nitrogênio", "nitrogenio", "wax"},
			Responses: []string{
				"⚠️ BRASAGEM COM NITROGÊNIO CONTÍNUO: Objetivo: prevenir oxidação interna. Pressão nitrogênio: 3-5 PSI (suave, contínuo). Pressão teste nitrogênio: R-22: 450 PSI, R-410A: 600 PSI, R-32: 580 PSI (COM detector A2L monitorando). NUNCA exceder pressão máxima do componente mais fraco. Sem nitrogênio = carepa de óxido dentro dos tubos = falha futura.",
				"Procedimento de brazagem correto: 1) Nitrogênio contínuo (3-5 PSI) durante todo processo. 2) Aquecer uniforme - não aquecer direto na solda. 3) Aplicar calor no tubo, não na solda. 4) Solda flui por capilaridade. 5) Manter nitrogênio até esfriar completamente. Sem nitrogênio = oxidação interna = compressor vai falhar.",
			},
			Priority: 12,
		},
		{
			Keywords: []string{"vácuo", "vazio", "vaccum", "500 microns", "microns", "teste shutoff"},
			Responses: []string{
				"⚠️ VÁCUO ANTES DA CARGA: TEMPO MÍNIMO: Até 3TR (10k BTU): 20 min. 3-10TR (10-35k BTU): 30 min. 10-20TR (35-70k BTU): 45 min. >20TR (>70k BTU): 60+ min. VÁCUO BOM: <300 microns. VÁCUO EXCELENTE: <200 microns. TESTE SHUTOFF: desligar bomba, esperar 5-10 min. Se subir >100 microns = vazamento ou umidade.",
				"Por que fazer vácuo? Umidade no sistema causa: formação de ácido (corrosão), falha do compressor (partida com carga), gelo no tubo capilar, ruído anormal. Vácuo em duas etapas: 1) Primário: até <300 microns, manter 30 min. 2) Teste de mantença: observar se sobe. Se estável, fazer carga. Se subir, tem vazamento ou umidade.",
			},
			Priority: 12,
		},
		{
			Keywords: []string{"gwp", "impacto ambiental", "ecológico", "ozônio", "protocolo de montreal"},
			Responses: []string{
				"Comparativo ambiental: R-22: GWP=1810 (eliminação 2030). R-410A: GWP=2088 (em uso). R-32: GWP=675 (+77% menor que R-410A). R-290 (propano): GWP=3 (baixo), mas A3 (inflamável). R-32 é substituto preferido por ser A2L (baixa inflamabilidade) e baixo GWP. Técnico deve recuperar e reciclar TODO refrigerante - é crime ambiental liberar na atmosfera.",
				"Cronograma de eliminação: R-22 já proibido para equipamentos novos desde 2015. R-410A está em avaliação para substituições futuras. R-32 é a tendência no Brasil atual.",
			},
			Priority: 6,
		},
		// ===== SEGURANÇA ELÉTRICA =====
		{
			Keywords: []string{"alta tensão", "400v", "300v", "capacitor matar", "descarga capacitor"},
			Responses: []string{
				"⚠️ CAPACITORES MANTÊM CARGA LETAL: Barramento DC (inverter): 300-400V por 30 MINUTOS após desligar. Capacitor partida: 250-450V AC. PROCEDIMENTO DE DESCARGA: 1) Desligar disjuntor. 2) AGUARDAR 15-30 MINUTOS. 3) Usar resistor 10kΩ/5W entre terminais por 10 segundos. 4) Medir tensão → 0V ANTES de tocar. NUNCA: fio nu, resistor <5W, tocar diretamente.",
				"DESCARGA DE EMERGÊNCIA: Materiais: resistor 10kΩ/5W, fios com garras jacaré. Tempo de descarga: ~30 segundos para 95%. ⚠️ NUNCA USAR: fio sem resistor (curto!), resistor <1W (superaquecimento). Capacitor OK pode ter 200-600V mesmo horas após desligar - TRATE COM RESPEITO.",
			},
			Priority: 15,
		},
		{
			Keywords: []string{"epi", "luvas", "óculos", "segurança", "epis"},
			Responses: []string{
				"EPIs OBRIGATÓRIOS por tipo de trabalho: BÁSICO: óculos de proteção, luvas de proteção, calçados fechados. ELÉTRICO: luvas isolantes classe 0 (1000V), calçados dielétricos, ferramentas isoladas. BRASAGEM: luvas de raspa, avental de couro, óculos de soldador (sombra 4-6), respirador para fumos. R-32 (A2L): luvas anti-estáticas, detector portátil de inflamabilidade, calçado condutivo.",
				"Regra de segurança: NUNCA trabalhe sozinho em área fechada com equipamentos elétricos. Tenha sempre: extintor CO2 acessível (classe C), telefone para emergências, e segundo técnico por perto. Em caso de choque: não tocar na pessoa, desligar fonte, chamar emergência (192/SAMU).",
			},
			Priority: 12,
		},
		// ===== INVERSOR VS TRADICIONAL =====
		{
			Keywords: []string{"inverter versus convencional", "dc inverter", "ac inverter", "diferença inverter"},
			Responses: []string{
				"DC INVERTER vs TRADICIONAL: TRADICIONAL (on/off): partida direta com pico (5-7x nominal), ciclo binário, temp oscila ±2-3°C, capacitor partida necessário. DC INVERTER: partida suave, velocidade variável (10-100%), temp estável ±0.5°C, SEM capacitor partida, IPM/drive controla frequência, range RPM 900-7.500.",
				"Como identificar DC vs AC Inverter pelo teste: DC Inverter: resistência U-V = 1-5Ω (baixa), tensão saída 30-220V DC (retificada). AC Inverter: resistência U-V = 5-20Ω (mais alta), tensão saída 220-240V AC. DC Inverter é o padrão atual no Brasil.",
			},
			Priority: 8,
		},
		// ===== TABELAS DE REFERÊNCIA RÁPIDA =====
		{
			Keywords: []string{"pressão alta", "pressão baixa", "leitura manifold", " PSI", "bar"},
			Responses: []string{
				"PRESSÕES R-410A por temperatura ambiente (unidade externa à sombra): 25°C: Alta 270-304 PSI, Baixa 145-170 PSI. 30°C: Alta 310-341 PSI, Baixa 155-185 PSI. 35°C: Alta 355-382 PSI, Baixa 168-200 PSI. 40°C: Alta 400-426 PSI, Baixa 185-225 PSI. IMPORTANTE: unidade externa ao sol = pressão ainda mais alta.",
				"PRESSÕES R-32 (~10-15% mais que R-410A): 25°C: Alta 335-360 PSI, Baixa 170-190 PSI. 30°C: Alta 374-400 PSI, Baixa 190-215 PSI. 35°C: Alta 415-450 PSI, Baixa 210-240 PSI. ⚠️ R-32 A2L: usar manifold rating para A2L. Detectores de vazamento para R-32 são OBRIGATÓRIOS.",
			},
			Priority: 10,
		},
		{
			Keywords: []string{"reparar ou substituir", "vale a pena", "custo benefício", "trocar compressor", "trocar placa"},
			Responses: []string{
				"REGRA DE DECISÃO: Idade <3 anos → Reparar (garantia). Idade 3-7 anos → Analisar custo/benefício. Idade 7-10 anos → Substituir geralmente mais econômico. Idade >10 anos → Substituir (nova tecnologia + eficiência). REPARAR: Capacitor R$ 30-80, Sensor R$ 20-50, Placa R$ 150-400. SUBSTITUIR: Compressor R$ 1500-4000, IPM R$ 800-1800, Placa principal R$ 600-1500.",
				"Se mais de 3 peças com problema = geralmente substituir sai mais barato. Regra 50%: se reparo >50% valor de um Split novo, considerar substituição. Também considere: custo do gás (R$ 80-120/kg para R-410A), mão de obra, e se o equipamento é eficiente (inverter vs convencional).",
			},
			Priority: 8,
		},
		// ===== DOCUMENTAÇÃO E LEGALIDADE =====
		{
			Keywords: []string{"art", "crea", "cft", "certificação", "nota fiscal", "garantia"},
			Responses: []string{
				"DOCUMENTAÇÃO OBRIGATÓRIA para técnico brasileiro: ART/CREA ou CFT: Obrigatório para instalação (>60.000 BTU). Certidão de Calibração: Manifold e multímetro (validade 12 meses). Nota fiscal: Obrigatória para todo serviço. Garantia legal: 90 dias (CDC art. 26) + garantia fabricante (geralmente 1 ano peças, 5 anos compressor).",
				"NORMA ABNT Aplicáveis: NBR 16271 (desempenho AC), NBR 16402 (instalação residencial), NBR ISO 5149 (segurança refrigeração), NBR 14679 (manutenção preventiva), NR-10 (segurança elétrica). DESCARTE RESÍDUOS: Óleo → ponto de coleta. Capacitores → reciclador credenciado. Placas → REEE/eletrônicos. Gás → usar recuperadora (NUNCA liberar na atmosfera - crime ambiental).",
			},
			Priority: 6,
		},
		// ===== RESFRIAMENTO / AQUECIMENTO =====
		{
			Keywords: []string{"não gela", "não esfria", "ar quente", "pouco frio", "não resfria", "quente demais"},
			Responses: []string{
				"Quando o ar não gela, as causas mais comuns são: 1) Filtro sujo bloqueando a circulação de ar. Limpe o filtro com água e deixe secar antes de recolocar. 2) Temperatura mal configurada - verifique se está em modo \"frio\" e a temperatura está baixa o suficiente (18-20°C). 3) Evaporadora (unidade interna) com sujeira acumulada. 4) Gás refrigerante baixo, o que exige técnico especializado para verificar vazamentos.",
				"Primeira coisa: conferiu o filtro do ar? Filtro sujo é o motivo número um de ar que não gela. Se o filtro estiver limpo, verifique se as pás estão bem posicionadas e se não tem nada bloqueando a saída de ar. Às vezes também ajuda desligar o aparelho da tomada por 10 minutos e ligar de novo - é tipo dar um reset.",
				"Ar que não gela pode ser sinal de filtro sujo, falta de gás ou problema no compressor. Comece verificando o filtro - é a causa mais simples e mais comum. Se depois de limpar o filtro o problema persistir, aí sim pode ser algo mais sério.",
			},
			Priority: 10,
		},
		{
			Keywords: []string{"não desliga", "ficou ligando", "desligando sozinho", "reiniciando"},
			Responses: []string{
				"Se o ar está ligando e desligando sozinho, pode ser problema de tensão elétrica (quando outros equipamentos estão na mesma tomada) ou o sensor de temperatura está com defeito. Tente ligar o ar direto na tomada, sem extensão. Se continuar, chame um técnico porque pode ser sensor interno com problema.",
				"Ciclar ligando e desligando muito rápido se chama \"short cycling\" e geralmente é causado por: 1) Filtro muito sujo restringindo airflow, 2) Temperatura externa muito alta, 3) Problema no sensor de temperatura da evaporadora, ou 4) Tensão elétrica instável na sua região. Verifique esses itens antes de chamar técnico.",
			},
			Priority: 8,
		},
		// ===== RUÍDOS =====
		{
			Keywords: []string{"barulho", "ruído", "ruido", "vibracao", "vibração", "som estranho", "chiado", "bip"},
			Responses: []string{
				"Ruídos no ar condicionado podem ser varias coisas: 1) Chiado leve é normal no início do funcionamento (gás pressurizando). 2) Tilintar ou clank pode ser peça solta dentro do equipamento. 3) Zumbido alto pode ser problema no motor do ventilador. 4) Vibração excessiva geralmente é falta de nível - o aparelho está torto ou mal apoiado. Se o ruído for muito forte ou estranho, melhor um técnico dar uma olhada.",
				"Ar condicionado que faz barulho geralmente não é boa notícia. Ruídos agudos podem ser problema no compressor. Vibração e clank podem ser peças soltas ou falta de Nivelação. Se o ruído появился de repente (não estava acontecendo antes), provavelmente tem algo solto ou com problema. Não ignore barulhos novos - eles costumam indicar que algo precisa de atenção antes de virar problema maior.",
			},
			Priority: 8,
		},
		// ===== CÓDIGOS DE ERRO =====
		{
			Keywords: []string{"erro e1", "codigo e1", "falha e1", "e1"},
			Responses: []string{
				"O código E1 geralmente indica problema no sensor de temperatura da evaporadora (unidade interna). Em alguns modelos significa \"sensor desconectado\" ou \"sensor com defeito\". Você pode tentar resetar o aparelho desligando da tomada por 5 minutos. Se o erro voltar, é necessário trocar o sensor - chame um técnico certificado.",
				"E1 é um erro de sensor. Na maioria das vezes é o sensor de temperatura da unidade interna com problema ou desconectado. Resetar o aparelho costuma resolver temporariamente, mas se aparecer de novo, o sensor precisa ser substituído.",
			},
			ErrorCodes: []string{"e1", "erro e1"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e2", "codigo e2", "falha e2", "e2"},
			Responses: []string{
				"O código E2 normalmente indica superaquecimento da unidade externa ou problema no sensor de temperatura ambiente. Verifique se a unidade externa está em local com ventilação adequada, sem objetos bloqueando. Limpe as aletas do condensador com escova macia. Se o erro persistir, pode ser necessidade de limpeza profunda ou problema no compressor.",
				"E2 é relacionado à temperatura - geralmente a unidade externa está superaquecendo. Isso acontece muito quando o condensador (unidade de fora) está sujo ou com ventilação ruim. Verifique se tem plantas, cortinas ou móveis bloqueando a circulação de ar na unidade externa.",
			},
			ErrorCodes: []string{"e2", "erro e2"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e3", "codigo e3", "falha e3", "e3"},
			Responses: []string{
				"E3 geralmente indica problema no sistema de refrigeração - pode ser falta de gás, obstrução no circuito ou problema na válvula de expansão. Este erro é mais sério e geralmente requer técnico especializado. Não tente resolver sozinho - pode agravar o problema.",
				"O código E3 é um dos mais sérios - indica problema no ciclo de refrigeração. Pode ser vazamento de gás, obstrução no tubing ou falha na válvula de expansão. Se aparecer este código, pare de usar o aparelho e chame um técnico de refrigeração. Quanto mais você usar nestas condições, pior pode ficar.",
			},
			ErrorCodes: []string{"e3", "erro e3"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e4", "codigo e4", "falha e4", "e4"},
			Responses: []string{
				"E4 normalmente indica superaquecimento da unidade interna ou problema no sensor de temperatura. Verifique se o filtro está limpo e se há boa circulação de ar. Desligue o aparelho por alguns minutos e ligue novamente. Se persistir, pode ser sensor com defeito.",
			},
			ErrorCodes: []string{"e4", "erro e4"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e5", "codigo e5", "falha e5", "e5"},
			Responses: []string{
				"E5 pode ter significados diferentes selon a marca: às vezes indica problema na comunicação entre unidades (inverter), outras vezes problema no sensor de temperatura externa. Se seu ar é Inverter, este erro pode ser mais sério. Forneça o modelo completo do seu aparelho para eu dar uma informação mais precisa.",
			},
			ErrorCodes: []string{"e5", "erro e5"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e6", "codigo e6", "falha e6", "e6"},
			Responses: []string{
				"O código E6 é sério e geralmente indica problema no compressor. Pode ser: compressor com problema elétrico, falha no启动了 (partida), ou sobrecarga. Não continue usando o aparelho se aparecer E6 - pode danificar o compressor permanentemente. Chame um técnico de refrigeração o mais rápido possível. Em alguns casos pode ser só um mau contato, mas só técnico pode diagnosticar.",
				"E6 é o código de erro mais preocupante porque envolve o compressor - o coração do ar condicionado. Pode significar que o compressor está com dificuldade para ligar, está superaquecendo ou tem problema elétrico. Uso prolongado com este erro pode Queimar o compressor, que é a peça mais cara para trocar. Melhoras parado e chamar técnico.",
			},
			ErrorCodes: []string{"e6", "erro e6"},
			Priority: 15,
		},
		{
			Keywords: []string{"erro e9", "codigo e9", "falha e9", "e9"},
			Responses: []string{
				"E9 geralmente indica problema na válvula de expansão eletrônica ou na comunicação entre unidades (em modelos split). Em alguns casos pode ser simplesmente água na bandeja de condensado transbordando. Verifique se o dreno não está entupido. Se não for isso, é questão eletrônica mesmo.",
			},
			ErrorCodes: []string{"e9", "erro e9"},
			Priority: 15,
		},
		// ===== MANUTENÇÃO =====
		{
			Keywords: []string{"manutenção", "preventiva", "limpeza", "periodica"},
			Responses: []string{
				"Para manter seu ar funcionando bem e durar mais, faça isso regularmente: 1) Limpe o filtro mensalmente (retire, lave com água, seque bem). 2) Limpe a evaporadora (unidade interna) a cada 3 meses com escova ou pano úmido. 3) Limpe o condensador (unidade externa) a cada 6 meses, tirando folhas e sujeira. 4) Faça uma limpeza profissional dos dutos pelo menos uma vez por ano. Ar bem mantido gasta menos energia e dura mais.",
				"Dica de manutenção: filtro limpo é o mais importante - além de prejudicar o resfriamento, filtro sujo força o aparelho e pode quadruplicar o consumo de energia! Depois do filtro, a bandeja de condensado merece atenção: se entupir, pode criar mosquito da dengue. Semanas que o ar não drena bem, é sinal de problema na bandeja ou dreno.",
				"Ar condicionado é como carro - precisa de manutenção regular. O mínimo que você pode fazer em casa: limpar ou trocar o filtro a cada 30 dias, manter a evaporadora livre de poeira, e garantir que o dreno não está entupido. A cada 12 meses, uma limpeza profissional com produtos específicos remove sujeira que você não consegue tirar em casa.",
			},
			Priority: 5,
		},
		{
			Keywords: []string{"filtro", "limpeza do filtro", "trocar filtro"},
			Responses: []string{
				"Para limpar o filtro do ar: 1) Desligue e desligue da tomada, 2) Abra a tampa da unidade interna, 3) Retire o filtro com cuidado, 4) Lave com água morna e sabão neutro, 5) Enxágue bem para tirar todo sabão, 6) Deixe secar completamente na sombra antes de recolocar (nunca use o ar com filtro molhado!). Se o filtro estiver muito velho ou rasgado, troque por um original da marca.",
				"Filtro sujo é o problema número um de ar que não gela e de contas de luz altas. O ideal é limpar a cada 2-4 semanas se usar todo dia. Filtro lavável é o mais comum - segue as instruções acima. Se o seu filtro for descartável (não lavável), troque a cada 3-6 meses dependendo do uso.",
			},
			Priority: 7,
		},
		{
			Keywords: []string{"gás", "refrigerante", "carregar gás", "falta gás"},
			Responses: []string{
				"Se você suspeita que está sem gás, provavelmente notará: ar que não gela mesmo com filtro limpo, unit externa congelando (gelo por cima), ou o ar saindo com cheiro estranho. Gás não acaba sozinho - se baixou, tem vazamento em algum lugar. Precisa chamar técnico de refrigeração para testar, encontrar o vazamento, consertar e só então recarregar. Não ignore - vazamento de gás refrigerante é prejudicial à saúde e ao meio ambiente.",
				"Gás de ar condicionado não é como combustível que acaba com o uso - ele circula num sistema fechado. Se baixou, tem vazamento. Punto. Só técnico com equipamento adequado pode detectar onde está vazando. Depois de consertar o vazamento, aí sim faz a recarga. Se alguém tentar passar石灰sua carga sem consertar o vazamento, o gás vai embora de novo.",
			},
			Priority: 10,
		},
		// ===== INSTALAÇÃO =====
		{
			Keywords: []string{"instalar", "instalação", "onde colocar", "local"},
			Responses: []string{
				"Dicas para uma boa instalação: 1) A unidade interna deve ficar em local alto, onde o ar circule livremente por todo o cômodo. 2) Não instale onde tem sol direto ou perto de fontes de calor. 3) A unidade externa precisa de ventilação boa, longe de paredes que bloqueiem o ar. 4) O dreno deve ter queda natural para fora - nunca para dentro. 5) A distância entre as unidades não deve ultrapassar o máximo permitido para seu modelo (geralmente 15-25 metros).",
				"Cuidado com Installation locations: nunca instale ar condicionado diretamente acima de fogão ou cooktop - a gordura e umidade vão danificar o aparelho. Também evite parede que receba sol da tarde sem proteção. Se for apartamento, verifique se a fachada permite fixar a unidade externa - alguns prédios têm regras. O técnico de instalação vai saber dimensionar o aparelho correto para cada cômodo.",
			},
			Priority: 5,
		},
		// ===== CONSERTOS / TROCA =====
		{
			Keywords: []string{"consertar", "reparar", "trocar peça", "substituir"},
			Responses: []string{
				"Se precisa de conserto, aqui vai uma dica importante: peça o diagnóstico por escrito antes de aprovar o serviço. O técnico deve dizer exatamente qual peça está com problema, quanto custa a peça e quanto cobra pela mão de obra. Desconfie de orçamentos muito baixos - às vezes incluem peças usadas ou de qualidade duvidosa. Peças originais são mais caras mas duram mais.",
				"Na hora de trocar peças, verifique: 1) Peça original é sempre a melhor opção. 2) Peças compatíveis de terceiros podem funcionar, mas depende da qualidade. 3) O compressor é a peça mais cara - às vezes não compensa trocar em aparelho muito velho. 4) Peça nota fiscal e garantia do serviço - pelo menos 90 dias na mão de obra.",
			},
			Priority: 5,
		},
		{
			Keywords: []string{"quanto custa", "preço", "orçamento", "valor"},
			Responses: []string{
				"Não consigo dar preços exatos porque variam muito por região e marca, mas posso dar uma ideia geral: visita técnica cobra entre R$ 100-250 só para ver o problema. Limpeza profissional sai entre R$ 150-400 dependendo do tamanho. Troca de sensor ou placa eletrônica: R$ 200-800 na peça + mão de obra. Troca de compressor: R$ 1200-3500 incluindo peça e serviço. Lembre-se: o mais barato nem sempre é o melhor, mas o mais caro também não garante qualidade.",
			},
			Priority: 3,
		},
		// ===== SPLIT / JANELA =====
		{
			Keywords: []string{"split", "splits", "janela", "portatil", "portátil"},
			Responses: []string{
				"Cada tipo tem suas vantagens: Split é o mais eficiente e silencioso, ideal para cômodos específicos. Janela é mais barato mas muito barulhento, indicado só como solução temporária. Portátil é para quem não pode instalar split, mas gasta mais energia e precisa de本地 de exaustão. Se você tem a opção, Split Inverter é o melhor em economia de energia e silêncio.",
				"Dica sobre tipos de ar: Split é muito melhor que janela ou portátil em termos de eficiência e conforto. Split Inverter pode economizar até 40% na conta de luz comparado ao convencional (não inverter). Se está pensando em comprar, vá de Split Inverter - o investimento extra se paga em alguns anos de conta de luz mais baixa.",
			},
			Priority: 4,
		},
		// ===== INVERTER =====
		{
			Keywords: []string{"inverter", "convencional", "on off", "ligar desligar"},
			Responses: []string{
				"A diferença principal: Conventional (on/off) liga no máximo e desliga quando chega na temperatura, fica ciclarando ligado-desligado. Inverter regula a velocidade do compressor, mantendo a temperatura mais estável e gastando menos energia. Inverter é mais caro na compra mas compensa na conta de luz se usar bastante. Se você só usa ar às vezes, um convencional pode ser mais vantajoso financeiramente.",
				"Inverter versus conventional: o Inverter调控a potênciad do compressor para manter a temperatura constante - sem aqueles ciclos de ligar e desligar que causam variação de temperatura e gastam mais energia. Para quem usa ar mais de 4-5 horas por dia, Inverter vale muito a pena. Para uso ocasional, o conventional é mais simples de manter e consertar.",
			},
			Priority: 4,
		},
		// ===== CONTA DE LUZ =====
		{
			Keywords: []string{"conta de luz", "consumo", "gasto", "energia", "kwh"},
			Responses: []string{
				"Para calcular o consumo do ar: potência (em watts) x horas usando / 1000 = kWh. Exemplo: um ar de 1000W usado 8 horas = 8 kWh. Multiplique pelo preço do kWh da sua distribuidora (em média R$ 0,60-0,90). Um split de 9000 BTU convencional gasta cerca de 25-30 kWh por mês se usar 8 horas/dia. Inverter gasta uns 40% menos. Dicas para economizar: mantenha o filtro limpo, use temperatura sensata (23-25°C é suficiente), e feche portas e janelas.",
				"Dica de economia: cada grau abaixo de 23°C aumenta o consumo em aproximadamente 8%! Manter em 24-25°C é um bom meio-termo entre conforto e economia. Também: o ar não resfria mais rápido se você colocar no máximo - ele resfria na mesma velocidade e só gasta mais. E nunca use ar com portas e janelas abertas - é dinheiro jogado fora.",
			},
			Priority: 5,
		},
		// ===== CONFORTO =====
		{
			Keywords: []string{"umido", "úmido", "humidade", "molhado", "suor"},
			Responses: []string{
				"Ar condicionado além de resfriar também desumidifica - é normal gotinhas de água escorrerem por fora da unidade (dreno). Se a umidade estiver muito alta no cômodo, o ar pode parecer \"abafado\" mesmo com temperatura baixa. Nesse caso, verificar se o filtro está limpo ajuda, porque filtro sujo reduz a capacidade de desumidificação. Modelos com modo \"dry\" ou desumidificação são melhores para regiões úmidas.",
				"Se você sente que o ar fica abafado mesmo frio, pode ser problema de umidade alta ou de airflow ruim. Verifique: filtro está limpo? Tem mobília bloqueando a saída de ar? O aparelho tem capacidade adequada para o tamanho do cômodo? Area muito grande para o ar gera sensação de abafado porque o aparelho não consegue Treat the air rapidamente suficiente.",
			},
			Priority: 5,
		},
		{
			Keywords: []string{"cheiro", "mofo", "fungo", "odor"},
			Responses: []string{
				"Cheiro de mofo no ar é sinal de filtro muito sujo ou mofo na evaporadora. Primeira solução: limpe o filtro. Se continuar, provavelmente tem mofo acumulado na evaporadora que só limpeza profissional resolve. Desligar o ar com o惜 fan ainda ligado por alguns minutos ajuda a secar a umidade interna. Atenção: se o cheiro for de gás (cheiro doce ou de amônia), desligue o ar imediatamente e chame técnico - pode ser vazamento!",
				"Para evitar cheiro de mofo: sempre que possível, desligue o ar pelo modo \"fan\" (ventilação) por 5-10 minutos antes de desligar completamente. Isso ajuda a secar a umidade da evaporadora. Também mantenha o filtro sempre limpo. Se mesmo assim continuar fedendo, provavelmente é mofo dentro da máquina mesmo e aí só limpeza profissional resolve.",
			},
			Priority: 6,
		},
		// ===== VAZAMENTO ÁGUA =====
		{
			Keywords: []string{"vazando", "vazamento de água", "gotejando", "pingando"},
			Responses: []string{
				"Água pingando do ar tem algumas causas: 1) Dreno entupido - a água não está saindo pelo cano e transborda na bandeja. 2) Instalação mal feita - a unidade está torta ou o dreno não tem inclinação certa. 3) Filtro muito sujo fazendo gelo e derretendo no lugar errado. 4) Gelo por dentro quando o gás está baixo. Primeira coisa: verifique se o dreno de fora está desobstruído. Se não resolver, chame técnico.",
				"Goteira no ar é chata mas raramente é problema sério. Na maioria das vezes é só dreno entupido com poeira e mofo. Você pode tentar desentupir soprando ar pelo bico do drain (com o ar desligado). Se não resolver em 2 minutos,para de insistir e chama técnico. Não deixe para depois porque a água pode danificar a parede ou teto.",
			},
			Priority: 8,
		},
		// ===== ÁGUA CONGELANDO =====
		{
			Keywords: []string{"gelo", "congelando", "garoa", "congelou"},
			Responses: []string{
				"Se está formando gelo no ar, as causas mais comuns são: filtro muito sujo restringindo airflow, ou gás baixo (comum em aparelhos mais velhos). NÃO tente tirar o gelo com objetos pontiagudos - pode furar os tubos de cobre e agravar o problema. Desligue o ar, deixe no modo ventilação até derreter o gelo, limpe o filtro, e ligue novamente. Se voltar a congelar, é falta de gás mesmo e só técnico resolve.",
				"Gelo na evaporadora é sempre sinal de problema. Na maioria dos casos é filtro sujo, mas também pode ser falta de gás ou problema no termostato. O gelo impede a troca de calor e pode danificar o equipamento. Não use o ar nestas condições. Se isso acontecer muito, é melhor um técnico fazer uma verificação completa.",
			},
			Priority: 10,
		},
		// ===== MARCAS =====
		{
			Keywords: []string{"springer", "midea", "lg", "samsung", "carrier", "consul", "Electrolux", "Philco", "Daikin", "gree"},
			BrandFilter: []string{"Springer", "Midea", "LG", "Samsung", "Carrier", "Consul", "Electrolux", "Philco", "Daikin", "Gree"},
			Responses: []string{
				"Você mencionou a marca [MARCA]. Cada marca tem seus pontos fortes: Springer e Consul são boas opções com bom suporte técnico no Brasil. Midea tem boa relação custo-benefício e tecnologia Inverter madura. LG e Samsung são mais tecnológicas mas peças podem ser mais caras. Carrier é mais premium. Se precisar de ajuda específica para essa marca, me diga o modelo completo que aparece no visor ou na nota fiscal.",
			},
			Priority: 3,
		},
		// ===== CÂMARA FRIA / COMERCIAL =====
		{
			Keywords: []string{"camara fria", "câmara fria", "refrigeracao comercial", "freezer", "baixa temperatura"},
			Responses: []string{
				"Câmera fria e refrigeração comercial são equipamentos diferentes dos ares condicionados domésticos. Os princípios são os mesmos (ciclo de compressão), mas a complexidade e os componentes são mais robustos. Para câmera fria, é essencial ter manutenção preventiva rigorosa porque uma pane pode significar perda de todo o estoque. Se trabalha com refrigeração comercial, aí precisa de técnico especializado mesmo - não é coisa de amador.",
			},
			Priority: 5,
		},
		// ===== CONTATO TÉCNICO =====
		{
			Keywords: []string{"tecnico", "técnico", "profissional", "especialista", "assistencia"},
			Responses: []string{
				"Para encontrar um bom técnico de ar condicionado: 1) Peça recomendações de amigos ou vizinhos que já usaram. 2) Verifique se tem CNPJ e se é regularizado - técnicos de refrigeração precisam ter registro. 3) Peça orçamento detalhado antes de aceitar - diagnóstico por telefone é furada, o técnico precisa ver o equipamento. 4) Desconfie de preços muito baixos ou de quem pede para pagar tudo antes. 5) Peça nota fiscal e garanta do serviço.",
				"Dica importante: técnico de ar condicionado não é o mesmo que \"ar-condicionado de janela\". Certifique-se que a pessoa tem experiência com o tipo de equipamento que você tem (split, multi-split, janela, etc). E nunca, nunca mesmo, deixe alguém sem CNPJ mexer no gás refrigerante - é crime ambiental e além disso a pessoa pode sumir se der problema.",
			},
			Priority: 3,
		},
	}
}

// AgentType implements AgentInterface.AgentType.
func (r *RulesResponseAgent) AgentType() string {
	return "rules"
}

// MaxRetries implements AgentInterface.MaxRetries.
func (r *RulesResponseAgent) MaxRetries() int {
	return 2
}

// TimeoutMs implements AgentInterface.TimeoutMs.
func (r *RulesResponseAgent) TimeoutMs() int {
	return 5000 // 5 seconds - rules matching is fast
}

// Execute implements AgentInterface.Execute.
func (r *RulesResponseAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
	// Get the user's message
	userMessage, _ := task.Input["normalized_text"].(string)
	if userMessage == "" {
		userMessage, _ = task.Input["query"].(string)
	}
	if userMessage == "" {
		userMessage, _ = task.Input["text"].(string)
	}

	intent, _ := task.Input["intent"].(string)
	entities, _ := task.Input["entities"].(map[string]interface{})
	messageID, _ := task.Input["message_id"].(string)

	// Match the best rule
	response := r.findBestResponse(userMessage, intent, entities)

	// Format for WhatsApp (4096 char limit)
	messages := r.formatForWhatsApp(response)

	return map[string]any{
		"response_text":  response,
		"sent_messages":  messages,
		"message_count":  len(messages),
		"response.success": true,
		"reply_to":       messageID,
	}, nil
}

// findBestResponse finds the best matching rule and returns a response.
func (r *RulesResponseAgent) findBestResponse(message, intent string, entities map[string]interface{}) string {
	if message == "" {
		return r.getDefaultResponse()
	}

	lowerMessage := strings.ToLower(message)
	var bestRule *TechnicalRule
	var bestScore int

	// Score each rule
	for i := range r.rules {
		rule := &r.rules[i]
		score := r.calculateMatchScore(rule, lowerMessage)

		if score > bestScore {
			bestScore = score
			bestRule = rule
		}
	}

	// If we found a decent match
	if bestRule != nil && bestScore >= 5 {
		response := bestRule.Responses[rand.Intn(len(bestRule.Responses))]
		// Replace [MARCA] placeholder if exists
		if brand, ok := entities["brand"].(string); ok {
			response = strings.ReplaceAll(response, "[MARCA]", brand)
		}
		return response
	}

	// Fallback
	return r.getFallbackResponse(message)
}

// calculateMatchScore scores how well a rule matches the message.
func (r *RulesResponseAgent) calculateMatchScore(rule *TechnicalRule, lowerMessage string) int {
	score := 0

	// Check error codes first (highest priority)
	for _, code := range rule.ErrorCodes {
		if strings.Contains(lowerMessage, strings.ToLower(code)) {
			score += 20
		}
	}

	// Check keywords
	for _, keyword := range rule.Keywords {
		if strings.Contains(lowerMessage, strings.ToLower(keyword)) {
			score += 5
		}
	}

	// Add priority bonus
	score += rule.Priority

	return score
}

// getFallbackResponse returns a response when no rule matches well.
func (r *RulesResponseAgent) getFallbackResponse(message string) string {
	fallbacks := []string{
		"Entendi sua mensagem, mas preciso de mais detalhes para ajudar. Pode descrever melhor o problema? Por exemplo: qual é o modelo do aparelho, desde quando está acontecendo, e se aparece algum código de erro no visor?",
		"Obrigado pela mensagem! Para eu ajudar melhor, me conta: 1) Qual é o problema que você está enfrentando? 2) O ar é split, janela ou portátil? 3) Desde quando começou? 4) Está aparecendo algum código de erro?",
		"Deixa eu ver se entendi direito. Você pode descrever o problema com mais detalhes? Por exemplo: o que o ar está fazendo de errado, há quanto tempo está assim, e se já tentou alguma coisa?",
	}

	// Try to extract error codes even in fallback
	lowerMsg := strings.ToLower(message)
	for _, rule := range r.rules {
		for _, code := range rule.ErrorCodes {
			if strings.Contains(lowerMsg, strings.ToLower(code)) {
				// Found an error code but no good match - provide generic help for that code
				return fmt.Sprintf("Você mencionou o código de erro %s. Esse é um problema que pode ter várias causas. Para eu ajudar melhor, me diga também: 1) Qual a marca e modelo do seu ar? 2) O que exatamente está acontecendo? 3) Apareceu de repente ou foi piorando aos poucos?", strings.ToUpper(code))
			}
		}
	}

	return fallbacks[rand.Intn(len(fallbacks))]
}

// getDefaultResponse returns a greeting/default response.
func (r *RulesResponseAgent) getDefaultResponse() string {
	greetings := []string{
		"Olá! Sou assistente técnico de ar condicionado. Como posso ajudar? Me conte o problema que você está enfrentando.",
		"Bem-vindo! Posso ajudar com dúvidas sobre ar condicionado. Qual é o problema?",
		"Oi! Estou aqui para ajudar com seu ar condicionado. O que está acontecendo?",
	}
	return greetings[rand.Intn(len(greetings))]
}

// formatForWhatsApp splits response into WhatsApp-compatible chunks.
func (r *RulesResponseAgent) formatForWhatsApp(response string) []string {
	const maxLength = 4096

	if len(response) <= maxLength {
		return []string{response}
	}

	// Split into chunks of maxLength, trying to break at sentence boundaries
	var messages []string
	remaining := response

	for len(remaining) > maxLength {
		// Find the last sentence boundary before maxLength
		chunk := remaining[:maxLength]
		lastPeriod := strings.LastIndex(chunk, ".")
		lastNewline := strings.LastIndex(chunk, "\n")
		lastBreak := lastPeriod
		if lastNewline > lastBreak {
			lastBreak = lastNewline
		}

		// If no good break point, break at maxLength
		if lastBreak < maxLength/2 {
			lastBreak = maxLength - 1
		} else {
			lastBreak++ // Include the break character
		}

		messages = append(messages, strings.TrimSpace(remaining[:lastBreak]))
		remaining = remaining[lastBreak:]
	}

	if len(remaining) > 0 {
		messages = append(messages, strings.TrimSpace(remaining))
	}

	return messages
}

// Ensure RulesResponseAgent implements AgentInterface
var _ AgentInterface = (*RulesResponseAgent)(nil)
