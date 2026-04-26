package models

import "strings"

// HVACModel represents a real HVAC model from Brazilian market (Buscapé April 2026).
type HVACModel struct {
	// Identificação
	Codigo        string `json:"codigo" qdrant:"codigo"`          // Código do produto (ex: 42EZVCA12M5)
	NomeCompleto  string `json:"nome_completo" qdrant:"nome_completo"` // Nome completo do modelo
	Marca        string `json:"marca" qdrant:"marca"`            // Springer, LG, Samsung, etc.
	Serie        string `json:"serie" qdrant:"serie"`            // Xtreme Save Connect, Dual Inverter, etc.

	// Especificações físicas
	CapacidadeBTU int    `json:"capacidade_btu" qdrant:"capacidade_btu"` // 12000, 18000, 24000
	Tipo         string `json:"tipo" qdrant:"tipo"`             // split, multi-split, piso-teto, cassette, chiller
	Tecnologia   string `json:"tecnologia" qdrant:"tecnologia"`       // inverter, convencional, VRF
	TipoCompressor string `json:"tipo_compressor" qdrant:"tipo_compressor"` // rotativo, scroll, linear
	Refrigerante string `json:"refrigerante" qdrant:"refrigerante"`     // R-32, R-410A, R-290

	// Faixa de preço (Reais)
	PrecoMin   int `json:"preco_min" qdrant:"preco_min"`
	PrecoMax   int `json:"preco_max" qdrant:"preco_max"`

	// Código de erros associados (opcional)
	CodigosErro []string `json:"codigos_erro,omitempty" qdrant:"codigos_erro"`
}

// BrandModels mapa todos os modelos por marca
var BrandModels = map[string][]HVACModel{
	"Springer/Midea": {
		// AI Ecomaster
		{Codigo: "42EZVCA12M5/38EZVCA12M5", NomeCompleto: "Springer AI Ecomaster 12000 BTU", Marca: "Springer", Serie: "AI Ecomaster", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1799, PrecoMax: 2199, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "42EZVCA09M5/38EZVCA09M5", NomeCompleto: "Springer AI Ecomaster 9000 BTU", Marca: "Springer", Serie: "AI Ecomaster", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1599, PrecoMax: 1899, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "42EZVCA24M5/38EZVCA24M5", NomeCompleto: "Springer AI Ecomaster 24000 BTU", Marca: "Springer", Serie: "AI Ecomaster", CapacidadeBTU: 24000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 2999, PrecoMax: 3499, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// AirVolution Connect
		{Codigo: "42AFVCI12M8/38AFVCI12M8", NomeCompleto: "Springer AirVolution Connect 12000 BTU", Marca: "Springer", Serie: "AirVolution Connect", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1999, PrecoMax: 2499, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Xtreme Save Connect
		{Codigo: "42AGVCI12M5/38AGVCI12M5", NomeCompleto: "Springer Xtreme Save Connect 12000 BTU", Marca: "Springer", Serie: "Xtreme Save Connect", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1699, PrecoMax: 2099, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "42MGVQI12M5/38MGVQI12M5", NomeCompleto: "Springer Xtreme Save Connect Black 12000 BTU", Marca: "Springer", Serie: "Xtreme Save Connect Black", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "42AGVQI18M5/38AGVQI18M5", NomeCompleto: "Springer Xtreme Save Connect 18000 BTU", Marca: "Springer", Serie: "Xtreme Save Connect", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 2499, PrecoMax: 2999, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
	},
	"LG": {
		// Dual Inverter Compact
		{Codigo: "S3-Q12JAQAL", NomeCompleto: "LG Dual Inverter Compact 12000 BTU", Marca: "LG", Serie: "Dual Inverter Compact", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		{Codigo: "S3-Q09AAQAK", NomeCompleto: "LG Dual Inverter Compact 9000 BTU", Marca: "LG", Serie: "Dual Inverter Compact", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1699, PrecoMax: 1999, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		// Dual Inverter Voice
		{Codigo: "S3-W12JA31A", NomeCompleto: "LG Dual Inverter Voice 12000 BTU", Marca: "LG", Serie: "Dual Inverter Voice", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2299, PrecoMax: 2799, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		{Codigo: "S3-Q24K231B", NomeCompleto: "LG Dual Inverter Voice 24000 BTU", Marca: "LG", Serie: "Dual Inverter Voice", CapacidadeBTU: 24000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 3499, PrecoMax: 4199, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		// AI Dual Inverter Voice
		{Codigo: "S3-Q12JA31L", NomeCompleto: "LG AI Dual Inverter Voice 12000 BTU", Marca: "LG", Serie: "AI Dual Inverter Voice", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 2599, PrecoMax: 3099, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		// Artcool
		{Codigo: "S4-Q12KA31A", NomeCompleto: "LG Artcool 12000 BTU", Marca: "LG", Serie: "Artcool", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2099, PrecoMax: 2599, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		{Codigo: "S4-Q18KA31A", NomeCompleto: "LG Artcool 18000 BTU", Marca: "LG", Serie: "Artcool", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2899, PrecoMax: 3499, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
		// Free Cool
		{Codigo: "S4-Q12GC31A", NomeCompleto: "LG Free Cool 12000 BTU", Marca: "LG", Serie: "Free Cool", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2199, PrecoMax: 2699, CodigosErro: []string{"E1", "CH01", "CH02", "CH10", "CH19", "E4"}},
	},
	"Samsung": {
		// Wind-Free
		{Codigo: "AR12TXHYASINUA", NomeCompleto: "Samsung Wind-Free 12000 BTU", Marca: "Samsung", Serie: "Wind-Free", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1999, PrecoMax: 2499, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		{Codigo: "AR09TXHYASINUA", NomeCompleto: "Samsung Wind-Free 9000 BTU", Marca: "Samsung", Serie: "Wind-Free", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1799, PrecoMax: 2199, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		{Codigo: "AR18TXHYASINUA", NomeCompleto: "Samsung Wind-Free 18000 BTU", Marca: "Samsung", Serie: "Wind-Free", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2999, PrecoMax: 3599, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		// Digital Inverter
		{Codigo: "AR12NSPHAURINUA", NomeCompleto: "Samsung Digital Inverter 12000 BTU", Marca: "Samsung", Serie: "Digital Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1699, PrecoMax: 2099, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		{Codigo: "AR09NSPHAURINUA", NomeCompleto: "Samsung Digital Inverter 9000 BTU", Marca: "Samsung", Serie: "Digital Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1499, PrecoMax: 1799, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		// Smart Air
		{Codigo: "AR12NSB1WLINUA", NomeCompleto: "Samsung Smart Air 12000 BTU", Marca: "Samsung", Serie: "Smart Air", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		// AR9500
		{Codigo: "AR12BXXXAJ5INUA", NomeCompleto: "Samsung AR9500 12000 BTU", Marca: "Samsung", Serie: "AR9500", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 2399, PrecoMax: 2899, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
		// Wall-Mounted Full Inverter
		{Codigo: "AR12BXXXEX3INUA", NomeCompleto: "Samsung Wall-Mounted Full Inverter 12000 BTU", Marca: "Samsung", Serie: "Wall-Mounted Full Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 2099, PrecoMax: 2599, CodigosErro: []string{"E1", "E4", "E101", "E102", "E103"}},
	},
	"Daikin": {
		// Air Performer
		{Codigo: "RXM25N3V1B", NomeCompleto: "Daikin Air Performer 9000 BTU", Marca: "Daikin", Serie: "Air Performer", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		{Codigo: "RXM35N3V1B", NomeCompleto: "Daikin Air Performer 12000 BTU", Marca: "Daikin", Serie: "Air Performer", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 2199, PrecoMax: 2699, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		{Codigo: "RXM50N3V1B", NomeCompleto: "Daikin Air Performer 18000 BTU", Marca: "Daikin", Serie: "Air Performer", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 3299, PrecoMax: 3999, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		// Smart Inverter
		{Codigo: "RXS25D3V1B", NomeCompleto: "Daikin Smart Inverter 9000 BTU", Marca: "Daikin", Serie: "Smart Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 1699, PrecoMax: 2099, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		// Floor Standing
		{Codigo: "FVA25A1V1B", NomeCompleto: "Daikin Floor Standing 9000 BTU", Marca: "Daikin", Serie: "Floor Standing", CapacidadeBTU: 9000, Tipo: "piso-teto", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 2999, PrecoMax: 3599, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		// Ururu Sarara
		{Codigo: "FTXZ25N3V1B", NomeCompleto: "Daikin Ururu Sarara 9000 BTU", Marca: "Daikin", Serie: "Ururu Sarara", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-32", PrecoMin: 4999, PrecoMax: 5999, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		// Multi Split
		{Codigo: "2MXM40N3V1B", NomeCompleto: "Daikin Multi Split 2×9000 BTU", Marca: "Daikin", Serie: "Multi Split", CapacidadeBTU: 18000, Tipo: "multi-split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 4499, PrecoMax: 5299, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
		{Codigo: "3MXM40N3V1B", NomeCompleto: "Daikin Multi Split 3×9000 BTU", Marca: "Daikin", Serie: "Multi Split", CapacidadeBTU: 27000, Tipo: "multi-split", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 5999, PrecoMax: 6999, CodigosErro: []string{"A1", "A5", "A6", "C4", "C9", "E1", "E3", "E5"}},
	},
	"Consul": {
		// Facilita
		{Codigo: "CBI12DB", NomeCompleto: "Consul Facilita 12000 BTU", Marca: "Consul", Serie: "Facilita", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1599, PrecoMax: 1999, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "CBI09DB", NomeCompleto: "Consul Facilita 9000 BTU", Marca: "Consul", Serie: "Facilita", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1399, PrecoMax: 1699, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Bem Estar
		{Codigo: "CBE12DB", NomeCompleto: "Consul Bem Estar 12000 BTU", Marca: "Consul", Serie: "Bem Estar", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "convencional", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1299, PrecoMax: 1599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Clarear
		{Codigo: "CCI12DB", NomeCompleto: "Consul Clarear 12000 BTU", Marca: "Consul", Serie: "Clarear", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1799, PrecoMax: 2199, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Maxi
		{Codigo: "CMI18SB", NomeCompleto: "Consul Maxi 18000 BTU", Marca: "Consul", Serie: "Maxi", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2499, PrecoMax: 2999, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Multi Split
		{Codigo: "CMS12DB", NomeCompleto: "Consul Multi Split 12000+6000 BTU", Marca: "Consul", Serie: "Multi Split", CapacidadeBTU: 18000, Tipo: "multi-split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2999, PrecoMax: 3599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
	},
	"Electrolux": {
		// Air System
		{Codigo: "AS12DB", NomeCompleto: "Electrolux Air System 12000 BTU", Marca: "Electrolux", Serie: "Air System", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1699, PrecoMax: 2099, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "AS09DB", NomeCompleto: "Electrolux Air System 9000 BTU", Marca: "Electrolux", Serie: "Air System", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1499, PrecoMax: 1799, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "AS18DB", NomeCompleto: "Electrolux Air System 18000 BTU", Marca: "Electrolux", Serie: "Air System", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2599, PrecoMax: 3099, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Maxi
		{Codigo: "MI12DB", NomeCompleto: "Electrolux Maxi 12000 BTU", Marca: "Electrolux", Serie: "Maxi", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Portable
		{Codigo: "UP12DB", NomeCompleto: "Electrolux Portable 12000 BTU", Marca: "Electrolux", Serie: "Portable", CapacidadeBTU: 12000, Tipo: "portatil", Tecnologia: "convencional", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2299, PrecoMax: 2799, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
	},
	"Philco": {
		// Inverter
		{Codigo: "PH12FV5B", NomeCompleto: "Philco Inverter 12000 BTU", Marca: "Philco", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1499, PrecoMax: 1899, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "PH09FV5B", NomeCompleto: "Philco Inverter 9000 BTU", Marca: "Philco", Serie: "Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1299, PrecoMax: 1599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "PH18FV5B", NomeCompleto: "Philco Inverter 18000 BTU", Marca: "Philco", Serie: "Inverter", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2299, PrecoMax: 2799, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "PH24FV5B", NomeCompleto: "Philco Inverter 24000 BTU", Marca: "Philco", Serie: "Inverter", CapacidadeBTU: 24000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2999, PrecoMax: 3599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
	},
	"Gree": {
		// Inverter
		{Codigo: "G-PC12AB", NomeCompleto: "Gree Inverter 12000 BTU", Marca: "Gree", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1399, PrecoMax: 1799, CodigosErro: []string{"E1", "E2", "E4", "F1", "F2", "F3"}},
		{Codigo: "G-PC09AB", NomeCompleto: "Gree Inverter 9000 BTU", Marca: "Gree", Serie: "Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1199, PrecoMax: 1499, CodigosErro: []string{"E1", "E2", "E4", "F1", "F2", "F3"}},
		{Codigo: "G-PC18AB", NomeCompleto: "Gree Inverter 18000 BTU", Marca: "Gree", Serie: "Inverter", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2199, PrecoMax: 2699, CodigosErro: []string{"E1", "E2", "E4", "F1", "F2", "F3"}},
		// Valore
		{Codigo: "G-VC12AB", NomeCompleto: "Gree Valore 12000 BTU", Marca: "Gree", Serie: "Valore", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1599, PrecoMax: 1999, CodigosErro: []string{"E1", "E2", "E4", "F1", "F2", "F3"}},
		// Eco
		{Codigo: "G-EC12AB", NomeCompleto: "Gree Eco 12000 BTU", Marca: "Gree", Serie: "Eco", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1299, PrecoMax: 1699, CodigosErro: []string{"E1", "E2", "E4", "F1", "F2", "F3"}},
	},
	"Fujitsu": {
		// Inverter
		{Codigo: "ASYG12LUCA", NomeCompleto: "Fujitsu Inverter 12000 BTU", Marca: "Fujitsu", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2299, PrecoMax: 2799, CodigosErro: []string{"AL", "E1", "E5", "E6", "E7", "E8"}},
		{Codigo: "ASYG09LUCA", NomeCompleto: "Fujitsu Inverter 9000 BTU", Marca: "Fujitsu", Serie: "Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1999, PrecoMax: 2499, CodigosErro: []string{"AL", "E1", "E5", "E6", "E7", "E8"}},
		{Codigo: "ASYG18LUCA", NomeCompleto: "Fujitsu Inverter 18000 BTU", Marca: "Fujitsu", Serie: "Inverter", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 3499, PrecoMax: 4199, CodigosErro: []string{"AL", "E1", "E5", "E6", "E7", "E8"}},
		// Multi
		{Codigo: "ASYG24LUCA", NomeCompleto: "Fujitsu Inverter 24000 BTU", Marca: "Fujitsu", Serie: "Inverter", CapacidadeBTU: 24000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 4299, PrecoMax: 5199, CodigosErro: []string{"AL", "E1", "E5", "E6", "E7", "E8"}},
	},
	"Elgin": {
		// Smart
		{Codigo: "E-INC12DB", NomeCompleto: "Elgin Smart 12000 BTU", Marca: "Elgin", Serie: "Smart", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1299, PrecoMax: 1699, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
		{Codigo: "E-INC09DB", NomeCompleto: "Elgin Smart 9000 BTU", Marca: "Elgin", Serie: "Smart", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1099, PrecoMax: 1399, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
		{Codigo: "E-INC18DB", NomeCompleto: "Elgin Smart 18000 BTU", Marca: "Elgin", Serie: "Smart", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2099, PrecoMax: 2599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
		// Eco
		{Codigo: "E-ECC12DB", NomeCompleto: "Elgin Eco 12000 BTU", Marca: "Elgin", Serie: "Eco", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1199, PrecoMax: 1599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
		// Portátil
		{Codigo: "E-PT12DB", NomeCompleto: "Elgin Portátil 12000 BTU", Marca: "Elgin", Serie: "Portátil", CapacidadeBTU: 12000, Tipo: "portatil", Tecnologia: "convencional", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
	},
	"Carrier": {
		// Sprint
		{Codigo: "42CVC12D", NomeCompleto: "Carrier Sprint 12000 BTU", Marca: "Carrier", Serie: "Sprint", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1699, PrecoMax: 2099, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		{Codigo: "42CVC09D", NomeCompleto: "Carrier Sprint 9000 BTU", Marca: "Carrier", Serie: "Sprint", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1499, PrecoMax: 1799, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Air Volution
		{Codigo: "42AVC12D", NomeCompleto: "Carrier Air Volution 12000 BTU", Marca: "Carrier", Serie: "Air Volution", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1999, PrecoMax: 2499, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
		// Newio
		{Codigo: "42TVC12D", NomeCompleto: "Carrier Newio 12000 BTU", Marca: "Carrier", Serie: "Newio", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2299, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6", "E8"}},
	},
	"Hisense": {
		// Neo Inverter
		{Codigo: "AP-12CR4U", NomeCompleto: "Hisense Neo Inverter 12000 BTU", Marca: "Hisense", Serie: "Neo Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1499, PrecoMax: 1899, CodigosErro: []string{"E0", "E1", "E2", "E4", "F1"}},
		{Codigo: "AP-09CR4U", NomeCompleto: "Hisense Neo Inverter 9000 BTU", Marca: "Hisense", Serie: "Neo Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1299, PrecoMax: 1599, CodigosErro: []string{"E0", "E1", "E2", "E4", "F1"}},
		{Codigo: "AP-18CR4U", NomeCompleto: "Hisense Neo Inverter 18000 BTU", Marca: "Hisense", Serie: "Neo Inverter", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2299, PrecoMax: 2799, CodigosErro: []string{"E0", "E1", "E2", "E4", "F1"}},
		// Super Inverter
		{Codigo: "AP-12SQ4U", NomeCompleto: "Hisense Super Inverter 12000 BTU", Marca: "Hisense", Serie: "Super Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-32", PrecoMin: 1699, PrecoMax: 2099, CodigosErro: []string{"E0", "E1", "E2", "E4", "F1"}},
	},
	"TCL": {
		// Inverter
		{Codigo: "TAC-12CHSA", NomeCompleto: "TCL Inverter 12000 BTU", Marca: "TCL", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1299, PrecoMax: 1699, CodigosErro: []string{"E0", "E1", "E2", "E4", "E8"}},
		{Codigo: "TAC-09CHSA", NomeCompleto: "TCL Inverter 9000 BTU", Marca: "TCL", Serie: "Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1099, PrecoMax: 1399, CodigosErro: []string{"E0", "E1", "E2", "E4", "E8"}},
		// Elite
		{Codigo: "TAC-12CHEA", NomeCompleto: "TCL Elite 12000 BTU", Marca: "TCL", Serie: "Elite", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1499, PrecoMax: 1899, CodigosErro: []string{"E0", "E1", "E2", "E4", "E8"}},
	},
	"Agratto": {
		// Inverter
		{Codigo: "AG12CI", NomeCompleto: "Agratto Inverter 12000 BTU", Marca: "Agratto", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1199, PrecoMax: 1599, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
		{Codigo: "AG09CI", NomeCompleto: "Agratto Inverter 9000 BTU", Marca: "Agratto", Serie: "Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 999, PrecoMax: 1299, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
		{Codigo: "AG18CI", NomeCompleto: "Agratto Inverter 18000 BTU", Marca: "Agratto", Serie: "Inverter", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1999, PrecoMax: 2499, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
	},
	"Hitachi": {
		// Inverter
		{Codigo: "RAC-12HPC", NomeCompleto: "Hitachi Inverter 12000 BTU", Marca: "Hitachi", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 2199, PrecoMax: 2699, CodigosErro: []string{"01", "02", "03", "04", "05", "06"}},
		{Codigo: "RAC-09HPC", NomeCompleto: "Hitachi Inverter 9000 BTU", Marca: "Hitachi", Serie: "Inverter", CapacidadeBTU: 9000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 1899, PrecoMax: 2399, CodigosErro: []string{"01", "02", "03", "04", "05", "06"}},
		{Codigo: "RAC-18HPC", NomeCompleto: "Hitachi Inverter 18000 BTU", Marca: "Hitachi", Serie: "Inverter", CapacidadeBTU: 18000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 3399, PrecoMax: 4099, CodigosErro: []string{"01", "02", "03", "04", "05", "06"}},
		// Floor/Ceiling
		{Codigo: "RCI-12HPC", NomeCompleto: "Hitachi Floor/Ceiling 12000 BTU", Marca: "Hitachi", Serie: "Floor/Ceiling", CapacidadeBTU: 12000, Tipo: "piso-teto", Tecnologia: "inverter", TipoCompressor: "scroll", Refrigerante: "R-410A", PrecoMin: 3999, PrecoMax: 4799, CodigosErro: []string{"01", "02", "03", "04", "05", "06"}},
	},
	"HQ": {
		// Inverter
		{Codigo: "HQ-INV12", NomeCompleto: "HQ Inverter 12000 BTU", Marca: "HQ", Serie: "Inverter", CapacidadeBTU: 12000, Tipo: "split", Tecnologia: "inverter", TipoCompressor: "rotativo", Refrigerante: "R-410A", PrecoMin: 999, PrecoMax: 1399, CodigosErro: []string{"E0", "E1", "E2", "E5", "E6"}},
	},
}

// AllModels returns all HVAC models flattened
func AllModels() []HVACModel {
	var all []HVACModel
	for _, models := range BrandModels {
		all = append(all, models...)
	}
	return all
}

// GetModelsByBrand returns models filtered by brand name (case-insensitive partial match)
func GetModelsByBrand(brand string) []HVACModel {
	brandLower := strings.ToLower(brand)
	var result []HVACModel
	for _, models := range BrandModels {
		for _, m := range models {
			if strings.ToLower(m.Marca) == brandLower || strings.ToLower(brandLower) == strings.ToLower(m.Marca) {
				result = append(result, m)
			}
		}
	}
	return result
}

// GetModelByCode returns a single model by its code
func GetModelByCode(codigo string) *HVACModel {
	for _, models := range BrandModels {
		for _, m := range models {
			if m.Codigo == codigo {
				return &m
			}
		}
	}
	return nil
}

// GetModelsByBTU returns models filtered by BTU capacity (exact match)
func GetModelsByBTU(btu int) []HVACModel {
	var result []HVACModel
	for _, models := range BrandModels {
		for _, m := range models {
			if m.CapacidadeBTU == btu {
				result = append(result, m)
			}
		}
	}
	return result
}

// GetModelsByType returns models filtered by type (split, multi-split, etc)
func GetModelsByType(tipo string) []HVACModel {
	tipoLower := strings.ToLower(tipo)
	var result []HVACModel
	for _, models := range BrandModels {
		for _, m := range models {
			if strings.ToLower(m.Tipo) == tipoLower {
				result = append(result, m)
			}
		}
	}
	return result
}

// GetModelsByTechnology returns models filtered by technology (inverter, convencional, VRF)
func GetModelsByTechnology(tecnologia string) []HVACModel {
	tecLower := strings.ToLower(tecnologia)
	var result []HVACModel
	for _, models := range BrandModels {
		for _, m := range models {
			if strings.ToLower(m.Tecnologia) == tecLower {
				result = append(result, m)
			}
		}
	}
	return result
}
