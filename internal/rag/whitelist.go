package rag

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"
)

// ManualStatus represents validation status of a manual
type ManualStatus int

const (
	ManualStatusUnknown ManualStatus = iota
	ManualStatusApproved
	ManualStatusRejected
	ManualStatusPending
)

// WhitelistEntry represents an approved HVAC model
type WhitelistEntry struct {
	ID          string    `json:"id"`
	Codigo      string    `json:"codigo"`
	NomeCompleto string   `json:"nome_completo"`
	Marca       string    `json:"marca"`
	Serie       string    `json:"serie"`
	CapacidadeBTU int     `json:"capacidade_btu"`
	Tipo        string    `json:"tipo"`
	Tecnologia  string    `json:"tecnologia"`
	CodigosErro []string `json:"codigos_erro,omitempty"`
	IsApproved  bool      `json:"is_approved"`
	ApprovedAt  time.Time `json:"approved_at"`
	Source      string    `json:"source"`
}

// BlacklistEntry represents a rejected manual
type BlacklistEntry struct {
	ID              string    `json:"id"`
	ManualHash      string    `json:"manual_hash"` // SHA-256
	SourceURL       string    `json:"source_url,omitempty"`
	Title           string    `json:"title,omitempty"`
	RejectionReason string    `json:"rejection_reason"`
	RejectedAt      time.Time `json:"rejected_at"`
	RejectedBy      string    `json:"rejected_by"` // 'auto', 'admin', 'qwen2.5-vl'
	QwenConfidence  float64   `json:"qwen_confidence,omitempty"`
}

// ManualChunk represents an indexed chunk from a manual
type ManualChunk struct {
	ID        string    `json:"id"`
	ModelID   string    `json:"model_id"`
	ChunkText string    `json:"chunk_text"`
	ChunkIndex int      `json:"chunk_index"`
	Section   string    `json:"section"`
	PageRef   int       `json:"page_ref,omitempty"`
	QdrantID  string    `json:"qdrant_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	IsVerified bool     `json:"is_verified"`
}

// WhitelistManager handles whitelist/blacklist operations
type WhitelistManager struct {
	entries    map[string]*WhitelistEntry // keyed by codigo
	blacklist  map[string]*BlacklistEntry // keyed by hash
	chunks     map[string][]*ManualChunk  // keyed by model_id
}

// NewWhitelistManager creates a new WhitelistManager
func NewWhitelistManager() *WhitelistManager {
	return &WhitelistManager{
		entries:   make(map[string]*WhitelistEntry),
		blacklist: make(map[string]*BlacklistEntry),
		chunks:    make(map[string][]*ManualChunk),
	}
}

// AddToWhitelist adds a model to the whitelist
func (wm *WhitelistManager) AddToWhitelist(entry *WhitelistEntry) {
	entry.IsApproved = true
	entry.ApprovedAt = time.Now()
	wm.entries[entry.Codigo] = entry
}

// AddToBlacklist adds a manual to the blacklist
func (wm *WhitelistManager) AddToBlacklist(entry *BlacklistEntry) {
	wm.blacklist[entry.ManualHash] = entry
}

// IsWhitelisted checks if a model code is whitelisted
func (wm *WhitelistManager) IsWhitelisted(codigo string) bool {
	_, exists := wm.entries[codigo]
	return exists
}

// IsBlacklisted checks if a manual hash is blacklisted
func (wm *WhitelistManager) IsBlacklisted(hash string) bool {
	_, exists := wm.blacklist[hash]
	return exists
}

// GetWhitelistEntry returns whitelist entry by code
func (wm *WhitelistManager) GetWhitelistEntry(codigo string) *WhitelistEntry {
	return wm.entries[codigo]
}

// GetByBrand returns all whitelisted models for a brand
func (wm *WhitelistManager) GetByBrand(brand string) []*WhitelistEntry {
	var result []*WhitelistEntry
	brandLower := strings.ToLower(brand)
	for _, entry := range wm.entries {
		if strings.ToLower(entry.Marca) == brandLower {
			result = append(result, entry)
		}
	}
	return result
}

// GetByBTU returns all whitelisted models for a BTU capacity
func (wm *WhitelistManager) GetByBTU(btu int) []*WhitelistEntry {
	var result []*WhitelistEntry
	for _, entry := range wm.entries {
		if entry.CapacidadeBTU == btu {
			result = append(result, entry)
		}
	}
	return result
}

// GetByType returns all whitelisted models for a type (split, multi-split, etc)
func (wm *WhitelistManager) GetByType(tipo string) []*WhitelistEntry {
	var result []*WhitelistEntry
	tipoLower := strings.ToLower(tipo)
	for _, entry := range wm.entries {
		if strings.ToLower(entry.Tipo) == tipoLower {
			result = append(result, entry)
		}
	}
	return result
}

// GetByTechnology returns all whitelisted models for technology (inverter, convencional)
func (wm *WhitelistManager) GetByTechnology(tech string) []*WhitelistEntry {
	var result []*WhitelistEntry
	techLower := strings.ToLower(tech)
	for _, entry := range wm.entries {
		if strings.ToLower(entry.Tecnologia) == techLower {
			result = append(result, entry)
		}
	}
	return result
}

// AddChunk adds a chunk to a model
func (wm *WhitelistManager) AddChunk(modelID string, chunk *ManualChunk) {
	wm.chunks[modelID] = append(wm.chunks[modelID], chunk)
}

// GetChunks returns all chunks for a model
func (wm *WhitelistManager) GetChunks(modelID string) []*ManualChunk {
	return wm.chunks[modelID]
}

// ComputeHash computes SHA-256 hash of manual content
func ComputeManualHash(content []byte) string {
	hash := sha256.Sum256(content)
	return hex.EncodeToString(hash[:])
}

// ComputeStringHash computes SHA-256 hash of string content
func ComputeStringHash(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}

// ValidationResult represents qwen2.5-vl verification result
type ValidationResult struct {
	DocumentType       string    `json:"document_type"` // service_manual, product_listing, marketing, unknown
	Confidence         float64   `json:"confidence"`
	HasDiagnosticContent bool    `json:"has_diagnostic_content"`
	Indicators         []string  `json:"indicators"`
	ErrorCodesFound    []string  `json:"error_codes_found"`
	ProceduresFound    []string  `json:"procedures_found"`
	SafetyWarningsFound bool      `json:"safety_warnings_found"`
	IsDuplicateLikely   bool      `json:"is_duplicate_likely"`
	DuplicateOfModel    string    `json:"duplicate_of_model,omitempty"`
	Reasoning          string     `json:"reasoning"`
}

// ShouldApprove returns true if manual should be approved for indexing
func (vr *ValidationResult) ShouldApprove() bool {
	// Must be service_manual with diagnostic content
	if vr.DocumentType != "service_manual" {
		return false
	}
	if !vr.HasDiagnosticContent {
		return false
	}
	if vr.Confidence < 0.6 {
		return false
	}
	// Reject if duplicate of known manual
	if vr.IsDuplicateLikely {
		return false
	}
	return true
}

// ShouldReject returns true if manual should be rejected
func (vr *ValidationResult) ShouldReject() bool {
	// Reject non-service-manuals
	if vr.DocumentType == "product_listing" || vr.DocumentType == "marketing" {
		return true
	}
	if !vr.HasDiagnosticContent {
		return true
	}
	if vr.Confidence < 0.4 {
		return true
	}
	return false
}

// GetRejectionReason returns human-readable rejection reason
func (vr *ValidationResult) GetRejectionReason() string {
	switch {
	case vr.DocumentType == "product_listing":
		return "product_listing_not_service_manual"
	case vr.DocumentType == "marketing":
		return "marketing_content_no_diagnostic"
	case !vr.HasDiagnosticContent:
		return "no_diagnostic_content_found"
	case vr.Confidence < 0.4:
		return "low_confidence"
	case vr.IsDuplicateLikely:
		return "duplicate_of_" + vr.DuplicateOfModel
	default:
		return "failed_validation"
	}
}

// PopulateFromBrandModels populates whitelist from BrandModels data
func (wm *WhitelistManager) PopulateFromBrandModels(brandModels map[string][]struct {
	Codigo         string
	NomeCompleto   string
	Marca          string
	Serie          string
	CapacidadeBTU  int
	Tipo           string
	Tecnologia     string
	CodigosErro    []string
}) {
	for _, models := range brandModels {
		for _, m := range models {
			wm.AddToWhitelist(&WhitelistEntry{
				ID:            generateID(),
				Codigo:        m.Codigo,
				NomeCompleto:  m.NomeCompleto,
				Marca:         m.Marca,
				Serie:         m.Serie,
				CapacidadeBTU: m.CapacidadeBTU,
				Tipo:          m.Tipo,
				Tecnologia:    m.Tecnologia,
				CodigosErro:   m.CodigosErro,
				IsApproved:    true,
				ApprovedAt:    time.Now(),
				Source:        "brand_models",
			})
		}
	}
}

// generateID generates a simple ID
func generateID() string {
	return time.Now().Format("20060102150405.000000")
}