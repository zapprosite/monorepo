package parser

import (
	"regexp"
	"strings"
	"unicode"
)

// Section types for HVAC manuals
const (
	SectionErrorCodes     = "ERROR_CODES"
	SectionSpecs          = "SPECS"
	SectionInstallation   = "INSTALLATION"
	SectionTroubleshooting = "TROUBLESHOOTING"
	SectionDiagnostic     = "DIAGNOSTIC"
	SectionWiring        = "WIRING"
	SectionMaintenance   = "MAINTENANCE"
	SectionGeneral       = "GENERAL"
)

// Section represents a detected section with page range
type Section struct {
	Type       string `json:"type"`
	StartPage  int    `json:"start_page"`
	EndPage    int    `json:"end_page"`
	Confidence float64 `json:"confidence"` // 0.0-1.0
	MatchedOn string `json:"matched_on"`  // keyword or pattern that matched
}

// SectionMap holds all detected sections for a document
type SectionMap struct {
	Sections []Section `json:"sections"`
	TotalPages int     `json:"total_pages"`
}

// sectionPattern defines keywords and regex patterns for section detection
type sectionPattern struct {
	SectionType string
	Keywords    []string
	Regex       *regexp.Regexp
	Weight      float64 // confidence weight when matched
}

var sectionPatterns = []sectionPattern{
	{
		SectionType: SectionErrorCodes,
		Keywords: []string{
			"ERROR", "CÓDIGO DE ERRO", "CODIGO DE ERRO", "ERRO", "FALHA",
			"故障码", "错误代码", "ERROR CODE", "CÓDIGO DE FALHA",
			"TABELA DE ERROS", "CODES", "FAULT CODE",
		},
		Regex: regexp.MustCompile(`(?i)\b(error|falha|código|codigo|fault)\s*(code|código|codigo)?\b`),
		Weight: 0.95,
	},
	{
		SectionType: SectionSpecs,
		Keywords: []string{
			"SPECIFICAÇÃO", "SPECIFICACAO", "SPECIFICATION", "SPECS",
			"ESPECIFICAÇÕES", "ESPECIFICACOES", "CARACTERÍSTICAS", "CARACTERISTICAS",
			"DADOS TÉCNICOS", "DADOS TECNICOS", "TECHNICAL DATA",
			"CAPACIDADE", "BTU", "POTÊNCIA", "POTENCIA", "TENSÃO", "TENSÃO",
			"VOLTAGE", "POWER", "CAPACITY", "DIMENSÕES", "DIMENSOES",
			"PESO", "WEIGHT", "REFRIGERANTE", "REFRIGERANT",
		},
		Regex: regexp.MustCompile(`(?i)\b(specif|caracter|dados|técnic|tecnc|capac|btu|potenc|tens|voltage|refrigeran)\b`),
		Weight: 0.85,
	},
	{
		SectionType: SectionInstallation,
		Keywords: []string{
			"INSTALAÇÃO", "INSTALACAO", "INSTALLATION", "INSTALL",
			"MONTAGEM", "MONTAR", "ASSEMBLY", "FIXAÇÃO", "FIXACAO",
			"INSTALAR", "INSTALLED", "PRECAUÇÕES", "PRECAUCOES",
			"WARNING", "CAUTION", "ATTENTION", "AVISO",
			"LOCAÇÃO", "LOCALIZACAO", "LOCATION", "POSIÇÃO", "POSICAO",
		},
		Regex: regexp.MustCompile(`(?i)\b(instal|mont|fixa|preca|warning|caution|aviso|loca|posi)\b`),
		Weight: 0.90,
	},
	{
		SectionType: SectionTroubleshooting,
		Keywords: []string{
			"TROUBLESHOOTING", "TROUBLESHOOT", "DIAGNÓSTICO DE PROBLEMAS",
			"DIAGNOSTICO DE PROBLEMAS", "PROBLEMA", "PROBLEMAS",
			"SOLUÇÃO", "SOLUCAO", "SOLUTION", "RESOLUÇÃO", "RESOLUCAO",
			"DEFEITO", "DEFEITOS", "INCIDENTE", "INCIDENTES",
			"GUIA DE PROBLEMAS", "Guia de problemas", "FAILURE",
		},
		Regex: regexp.MustCompile(`(?i)\b(troubleshoot|proble|defeit|solu|resolu|failure)\b`),
		Weight: 0.92,
	},
	{
		SectionType: SectionDiagnostic,
		Keywords: []string{
			"DIAGNÓSTICO", "DIAGNOSTICO", "DIAGNOSTIC", "DIAGNOSTICS",
			"TESTE", "TEST", "TESTES", "TESTS", "MEDIÇÃO", "MEDICAO",
			"VERIFICAÇÃO", "VERIFICACAO", "CHECK", "CHECKING",
			"INSPEÇÃO", "INSPEÇÃO", "INSPECÇÃO", "INSPECCAO",
			"ANÁLISE", "ANALISE", "ANALYSIS", "MEDIDOR", "MEASUR",
			"MULTÍMETRO", "MULTIMETER", "MANÔMETRO", "MANOMETRO",
		},
		Regex: regexp.MustCompile(`(?i)\b(diagnost|teste|test|medi|verif|inspe|anal|multim|manom)\b`),
		Weight: 0.88,
	},
	{
		SectionType: SectionWiring,
		Keywords: []string{
			"WIRING", "FIAÇÃO", "FIACAO", "FIO", "FIOS", "WIRE", "WIRES",
			"ELETRICIDADE", "ELETRIC", "ELECTRIC", "ELECTRICAL",
			"CIRCUITO", "CIRCUITOS", "CIRCUIT", "SCHEMA",
			"ESQUEMA ELÉTRICO", "ESQUEMA ELETRICO", "DIAGRAMA",
			"DIAGRAM", "LIGAÇÃO", "LIGACAO", "CONEXÃO", "CONEXAO",
			"CONNECTION", "TERMINAL", "TERMINAIS", "REDE",
		},
		Regex: regexp.MustCompile(`(?i)\b(wir|fiao|fio|circuit|esquema|diagrama|ligac|conex|termin|rede)\b`),
		Weight: 0.90,
	},
	{
		SectionType: SectionMaintenance,
		Keywords: []string{
			"MAINTENANCE", "MANUTENÇÃO", "MANUTENCAO", "MANTER",
			"LIMPEZA", "LIMPEZA", "CLEANING", "CLEAN", "LIMPAR",
			"TROCA", "TROCAR", "REPLACEMENT", "REPLACE", "SUBSTITUIÇÃO",
			"SUBSTITUICAO", "FILTRO", "FILTERS", "FILTRO",
			"CONSERTO", "REPARO", "REPAIR", "AJUSTE", "ADJUST",
			"CALIBRAÇÃO", "CALIBRACAO", "CALIBRATION", "SERVIÇO", "SERVICO",
			"SERVICE", "CARE", "CUIDADOS", "CUIDADO",
		},
		Regex: regexp.MustCompile(`(?i)\b(mainten|manut|limp|troca|substitu|filtro|conser|repar|ajust|calibr|servic|cuid)\b`),
		Weight: 0.87,
	},
}

// headerLinePattern matches potential section headers (all caps, numbered, etc)
var headerLinePattern = regexp.MustCompile(`(?i)^[\s]*((?:SECTION|SECÇÃO|SECAO|Capítulo|CHAPTER|CAP|S\.\s*\d+|[A-Z]{2,}[\s-]?[A-Z]+)\s*[:.\-]?\s*)`)

// numberedSectionPattern matches numbered sections like "1.3 Error Codes"
var numberedSectionPattern = regexp.MustCompile(`(?i)^\s*(\d+\.)+\s*([a-zA-Z\s]+)\s*$`)

// DetectSectionsFromText scans text content and returns detected sections with page ranges
func DetectSectionsFromText(pages []string) SectionMap {
	sectionMap := SectionMap{
		Sections:   make([]Section, 0),
		TotalPages: len(pages),
	}

	if len(pages) == 0 {
		return sectionMap
	}

	// Track which section each page belongs to
	currentSection := SectionGeneral
	sectionStart := 0

	for pageNum, pageText := range pages {
		detected := detectSectionType(pageText)

		// If we detect a new section, close the current one
		if detected != currentSection && detected != SectionGeneral {
			if currentSection != SectionGeneral {
				sectionMap.Sections = append(sectionMap.Sections, Section{
					Type:       currentSection,
					StartPage:  sectionStart,
					EndPage:    pageNum - 1,
					Confidence: 0.85,
					MatchedOn: "transition",
				})
			}
			currentSection = detected
			sectionStart = pageNum
		}
	}

	// Close final section
	if currentSection != SectionGeneral {
		sectionMap.Sections = append(sectionMap.Sections, Section{
			Type:       currentSection,
			StartPage:  sectionStart,
			EndPage:    len(pages) - 1,
			Confidence: 0.85,
			MatchedOn: "final",
		})
	}

	return sectionMap
}

// detectSectionType determines section type from text content
func detectSectionType(text string) string {
	upper := strings.ToUpper(text)
	textLower := strings.ToLower(text)

	bestMatch := SectionGeneral
	highestScore := 0.0

	for _, pattern := range sectionPatterns {
		score := calculateSectionScore(upper, textLower, pattern)
		if score > highestScore {
			highestScore = score
			bestMatch = pattern.SectionType
		}
	}

	// Require minimum confidence threshold
	if highestScore < 0.3 {
		return SectionGeneral
	}

	return bestMatch
}

// calculateSectionScore computes match confidence for a section pattern
func calculateSectionScore(upperText, lowerText string, pattern sectionPattern) float64 {
	score := 0.0

	// Check regex match first (high value)
	if pattern.Regex != nil && pattern.Regex.MatchString(lowerText) {
		score += pattern.Weight * 0.6
	}

	// Count keyword matches
	keywordMatches := 0
	for _, kw := range pattern.Keywords {
		if strings.Contains(upperText, strings.ToUpper(kw)) {
			keywordMatches++
		}
	}

	// Normalize keyword score (more keywords = higher confidence, but diminishing returns)
	if len(pattern.Keywords) > 0 {
		normalizedKW := float64(keywordMatches) / float64(len(pattern.Keywords))
		score += normalizedKW * pattern.Weight * 0.4
	}

	return score
}

// DetectSectionHeader checks if a line is a section header
func DetectSectionHeader(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)

	// Check for all-caps headers
	if isLikelyHeader(trimmed) {
		upper := strings.ToUpper(trimmed)
		for _, pattern := range sectionPatterns {
			for _, kw := range pattern.Keywords {
				if strings.Contains(upper, strings.ToUpper(kw)) {
					return pattern.SectionType, true
				}
			}
		}
	}

	// Check numbered sections
	if numberedSectionPattern.MatchString(trimmed) {
		matches := numberedSectionPattern.FindStringSubmatch(trimmed)
		if len(matches) >= 2 {
			sectionName := strings.TrimSpace(matches[2])
			upper := strings.ToUpper(sectionName)
			for _, pattern := range sectionPatterns {
				for _, kw := range pattern.Keywords {
					if strings.Contains(upper, strings.ToUpper(kw)) {
						return pattern.SectionType, true
					}
				}
			}
		}
	}

	return "", false
}

// isLikelyHeader determines if a line looks like a section header
func isLikelyHeader(s string) bool {
	if len(s) == 0 || len(s) > 100 {
		return false
	}

	// All caps check
	isAllCaps := true
	hasLetter := false
	for _, r := range s {
		if unicode.IsLetter(r) {
			hasLetter = true
			if unicode.IsLower(r) {
				isAllCaps = false
			}
		}
	}

	// Must have letters and be relatively short (typical header length)
	if !hasLetter || len(s) > 60 {
		return false
	}

	// Check for common header delimiters
	hasDelimiter := false
	headerDelimiters := []string{":", ".", "-", "—", "–"}
	for _, d := range headerDelimiters {
		if strings.Contains(s, d) {
			hasDelimiter = true
			break
		}
	}

	return isAllCaps || hasDelimiter
}

// MergeAdjacentSections combines sections of the same type that are consecutive
func MergeAdjacentSections(sections []Section) []Section {
	if len(sections) <= 1 {
		return sections
	}

	merged := make([]Section, 0, len(sections))
	current := sections[0]

	for i := 1; i < len(sections); i++ {
		next := sections[i]
		if current.Type == next.Type {
			// Merge: extend current section
			current.EndPage = next.EndPage
			// Average confidence
			current.Confidence = (current.Confidence + next.Confidence) / 2
		} else {
			// Different type: save current and start new
			merged = append(merged, current)
			current = next
		}
	}
	merged = append(merged, current)

	return merged
}

// GetSectionPages returns page range for a given section type
func (sm *SectionMap) GetSectionPages(sectionType string) (start, end int, found bool) {
	for _, s := range sm.Sections {
		if s.Type == sectionType {
			return s.StartPage, s.EndPage, true
		}
	}
	return 0, 0, false
}

// HasSection checks if a section type exists in the map
func (sm *SectionMap) HasSection(sectionType string) bool {
	for _, s := range sm.Sections {
		if s.Type == sectionType {
			return true
		}
	}
	return false
}
