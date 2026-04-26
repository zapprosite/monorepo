package extractor

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// TableResult represents extracted table data
type TableResult struct {
	TableIndex int       `json:"table_index"`
	Content    string    `json:"content"`
	BBox       *[]float64 `json:"bbox,omitempty"`
	Page       *int      `json:"page,omitempty"`
}

// TablesOutput is the JSON output from tables.py
type TablesOutput struct {
	PDFPath      string        `json:"pdf_path"`
	TablesFound  int           `json:"tables_found"`
	Tables       []TableResult `json:"tables"`
}

// ExtractTables extracts tables from a PDF using Python docling
func ExtractTables(ctx context.Context, pdfPath string) (*TablesOutput, error) {
	// Check if Python script exists
	scriptPath := filepath.Join(filepath.Dir(os.Args[0]), "extractor", "tables.py")
	if _, err := os.Stat(scriptPath); err != nil {
		// Fallback to looking in current dir
		scriptPath = "extractor/tables.py"
	}

	// Run Python script
	cmd := exec.CommandContext(ctx, "python3", scriptPath, pdfPath)
	cmd.Dir = filepath.Dir(os.Args[0])

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("python tables extraction: %w", err)
	}

	var result TablesOutput
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("parse tables output: %w", err)
	}

	return &result, nil
}

// ExtractTablesToFile extracts tables and saves to JSON file
func ExtractTablesToFile(ctx context.Context, pdfPath, outputPath string) error {
	result, err := ExtractTables(ctx, pdfPath)
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal result: %w", err)
	}

	return os.WriteFile(outputPath, data, 0644)
}
