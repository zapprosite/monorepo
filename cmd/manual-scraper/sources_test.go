package main

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestLoadSources(t *testing.T) {
	yamlContent := `
sources:
  - name: lg
    url: "https://lg.com/br/suporte/manual"
    brand: LG
    type: split
    login_required: false
    selectors:
      model_list: ".product-list a"
      manual_link: "a[href$='.pdf']"
    repo: ""
    path: ""
  - name: samsung
    url: "https://samsung.com/br/support/manual"
    brand: Samsung
    type: split
    login_required: true
    selectors:
      model_list: ".support-products a"
      manual_link: "a.download-manual[href$='.pdf']"
    repo: ""
    path: ""
  - name: springer
    url: "https://springer.com/br/manuals"
    brand: Springer
    type: github
    login_required: false
    selectors:
      model_list: ".manual-categories a"
      manual_link: "a[href*='manual'][href$='.pdf']"
    repo: "springer/split-ac"
    path: "manuals/"
`

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "sources.yaml")
	if err := os.WriteFile(configPath, []byte(yamlContent), 0644); err != nil {
		t.Fatalf("failed to write temp config: %v", err)
	}

	sources, err := LoadSources(configPath)
	if err != nil {
		t.Fatalf("LoadSources returned error: %v", err)
	}

	if len(sources) != 3 {
		t.Errorf("expected 3 sources, got %d", len(sources))
	}

	if sources[0].Name != "lg" {
		t.Errorf("expected first source name 'lg', got %q", sources[0].Name)
	}
	if sources[0].Brand != "LG" {
		t.Errorf("expected first source brand 'LG', got %q", sources[0].Brand)
	}
	if sources[0].LoginRequired {
		t.Errorf("expected lg login_required to be false")
	}
	if sources[1].LoginRequired != true {
		t.Errorf("expected samsung login_required to be true")
	}
}

func TestLoadSources_FileNotFound(t *testing.T) {
	_, err := LoadSources("/nonexistent/path/sources.yaml")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}

func TestLoadSources_InvalidYAML(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "invalid.yaml")
	if err := os.WriteFile(configPath, []byte("invalid: [yaml: content"), 0644); err != nil {
		t.Fatalf("failed to write temp config: %v", err)
	}

	_, err := LoadSources(configPath)
	if err == nil {
		t.Error("expected error for invalid YAML")
	}
}

func TestLoadSources_MissingFile(t *testing.T) {
	_, err := LoadSources("")
	if err == nil {
		t.Error("expected error for empty path")
	}
}

func TestGetSourceByName(t *testing.T) {
	sources := []Source{
		{Name: "lg", Brand: "LG"},
		{Name: "samsung", Brand: "Samsung"},
		{Name: "springer", Brand: "Springer"},
	}

	result := GetSourceByName(sources, "samsung")
	if result == nil {
		t.Fatal("expected to find samsung source")
	}
	if result.Brand != "Samsung" {
		t.Errorf("expected brand 'Samsung', got %q", result.Brand)
	}

	nilResult := GetSourceByName(sources, "nonexistent")
	if nilResult != nil {
		t.Error("expected nil for nonexistent source")
	}
}

func TestGetSourceByName_EmptySlice(t *testing.T) {
	sources := []Source{}
	result := GetSourceByName(sources, "lg")
	if result != nil {
		t.Error("expected nil for empty slice")
	}
}

func TestGetSourcesByBrand(t *testing.T) {
	sources := []Source{
		{Name: "lg-ac", Brand: "LG"},
		{Name: "lg-tv", Brand: "LG"},
		{Name: "samsung-ac", Brand: "Samsung"},
		{Name: "springer", Brand: "Springer"},
	}

	lgSources := GetSourcesByBrand(sources, "LG")
	if len(lgSources) != 2 {
		t.Errorf("expected 2 LG sources, got %d", len(lgSources))
	}

	samsungSources := GetSourcesByBrand(sources, "Samsung")
	if len(samsungSources) != 1 {
		t.Errorf("expected 1 Samsung source, got %d", len(samsungSources))
	}

	carrierSources := GetSourcesByBrand(sources, "Carrier")
	if len(carrierSources) != 0 {
		t.Errorf("expected 0 Carrier sources, got %d", len(carrierSources))
	}
}

func TestGetSourcesByBrand_EmptySlice(t *testing.T) {
	sources := []Source{}
	result := GetSourcesByBrand(sources, "LG")
	if len(result) != 0 {
		t.Error("expected empty result for empty input slice")
	}
}

// TestSourceStruct ensures the YAML parsing produces correct structs
func TestSourceStruct(t *testing.T) {
	data := `
sources:
  - name: test-source
    url: "https://example.com/manuals"
    brand: TestBrand
    type: github
    login_required: true
    selectors:
      model_list: ".list a"
      manual_link: "a.pdf"
    repo: "org/repo"
    path: "docs/"
`

	var sources Sources
	if err := yaml.Unmarshal([]byte(data), &sources); err != nil {
		t.Fatalf("yaml.Unmarshal failed: %v", err)
	}

	if len(sources.Sources) != 1 {
		t.Fatalf("expected 1 source, got %d", len(sources.Sources))
	}

	s := sources.Sources[0]
	if s.Name != "test-source" {
		t.Errorf("expected name 'test-source', got %q", s.Name)
	}
	if s.URL != "https://example.com/manuals" {
		t.Errorf("expected url 'https://example.com/manuals', got %q", s.URL)
	}
	if s.Brand != "TestBrand" {
		t.Errorf("expected brand 'TestBrand', got %q", s.Brand)
	}
	if s.Type != "github" {
		t.Errorf("expected type 'github', got %q", s.Type)
	}
	if !s.LoginRequired {
		t.Error("expected login_required to be true")
	}
	if s.Selectors.ModelList != ".list a" {
		t.Errorf("expected model_list '.list a', got %q", s.Selectors.ModelList)
	}
	if s.Selectors.ManualLink != "a.pdf" {
		t.Errorf("expected manual_link 'a.pdf', got %q", s.Selectors.ManualLink)
	}
	if s.Repo != "org/repo" {
		t.Errorf("expected repo 'org/repo', got %q", s.Repo)
	}
	if s.Path != "docs/" {
		t.Errorf("expected path 'docs/', got %q", s.Path)
	}
}
