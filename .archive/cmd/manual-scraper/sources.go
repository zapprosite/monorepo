package main

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Source represents a manual source definition
type Source struct {
	Name         string   `yaml:"name"`
	URL          string   `yaml:"url"`
	Brand        string   `yaml:"brand"`
	Type         string   `yaml:"type"` // split, github, etc
	LoginRequired bool    `yaml:"login_required"`
	Selectors     Selectors `yaml:"selectors"`
	Repo         string   `yaml:"repo"`   // GitHub repos
	Path         string   `yaml:"path"`   // GitHub path
}

// Selectors contains CSS selectors for scraping
type Selectors struct {
	ModelList  string `yaml:"model_list"`
	ManualLink string `yaml:"manual_link"`
}

// Sources is the list of all configured sources
type Sources struct {
	Sources []Source `yaml:"sources"`
}

// LoadSources loads source definitions from a YAML file
func LoadSources(path string) ([]Source, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	var sources Sources
	if err := yaml.Unmarshal(data, &sources); err != nil {
		return nil, fmt.Errorf("parse YAML: %w", err)
	}

	return sources.Sources, nil
}

// GetSourceByName finds a source by its name
func GetSourceByName(sources []Source, name string) *Source {
	for i := range sources {
		if sources[i].Name == name {
			return &sources[i]
		}
	}
	return nil
}

// GetSourcesByBrand filters sources by brand
func GetSourcesByBrand(sources []Source, brand string) []Source {
	var result []Source
	for _, s := range sources {
		if s.Brand == brand {
			result = append(result, s)
		}
	}
	return result
}