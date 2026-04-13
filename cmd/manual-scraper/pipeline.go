package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/will-zappro/hvacr-swarm/cmd/manual-scraper/indexer"
	"github.com/will-zappro/hvacr-swarm/cmd/manual-scraper/scraper"
	"github.com/will-zappro/hvacr-swarm/internal/rag"
	"github.com/will-zappro/hvacr-swarm/internal/rag/qdrant"
)

// PipelineConfig holds configuration for the scraping pipeline
type PipelineConfig struct {
	OutputDir    string
	OllamaURL    string
	QdrantAddr   string
	RateLimit    time.Duration
	MaxDownloads int
	Verbose      bool
	ChromePath   string
}

// Pipeline orchestrates the full scraping → indexing flow
type Pipeline struct {
	config     PipelineConfig
	browser    *scraper.Browser
	downloader *scraper.Downloader
	embedder   *indexer.OllamaEmbedder
	qdrant     *qdrant.Client
	chunker    *rag.Chunker
	logger     *slog.Logger
}

// NewPipeline creates a new scraping pipeline
func NewPipeline(cfg PipelineConfig) (*Pipeline, error) {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	// Initialize components
	browser, err := scraper.NewBrowser(true, cfg.ChromePath)
	if err != nil {
		return nil, fmt.Errorf("create browser: %w", err)
	}

	downloader := scraper.NewDownloader(cfg.OutputDir)
	downloader.SetRateLimit(cfg.RateLimit)

	embedder := indexer.NewOllamaEmbedder(cfg.OllamaURL)

	qdrantClient, err := qdrant.NewClient(cfg.QdrantAddr)
	if err != nil {
		return nil, fmt.Errorf("create qdrant client: %w", err)
	}

	if err := qdrantClient.CreateCollection(context.Background()); err != nil {
		logger.Warn("create collection (may already exist)", "error", err)
	}

	chunker := rag.NewChunker()

	return &Pipeline{
		config:     cfg,
		browser:    browser,
		downloader: downloader,
		embedder:   embedder,
		qdrant:     qdrantClient,
		chunker:    chunker,
		logger:     logger,
	}, nil
}

// Run executes the full scraping → indexing pipeline for a source
func (p *Pipeline) Run(ctx context.Context, source Source) error {
	p.logger.Info("starting pipeline", "source", source.Name, "brand", source.Brand)

	// Phase 1: Scrape
	pdfURLs, err := p.scrape(ctx, source)
	if err != nil {
		return fmt.Errorf("scrape: %w", err)
	}
	p.logger.Info("phase 1 complete", "urls_found", len(pdfURLs))

	// Phase 2: Download
	downloaded, err := p.download(ctx, pdfURLs, source.Brand)
	if err != nil {
		return fmt.Errorf("download: %w", err)
	}
	p.logger.Info("phase 2 complete", "files_downloaded", len(downloaded))

	// Phase 3: Extract + Chunk + Index
	indexed, err := p.index(ctx, downloaded, source.Brand)
	if err != nil {
		return fmt.Errorf("index: %w", err)
	}
	p.logger.Info("phase 3 complete", "chunks_indexed", indexed)

	return nil
}

// scrape navigates to source and extracts PDF URLs
func (p *Pipeline) scrape(ctx context.Context, source Source) ([]string, error) {
	if err := p.browser.Navigate(ctx, source.URL); err != nil {
		return nil, fmt.Errorf("navigate to %s: %w", source.URL, err)
	}

	links, err := p.browser.FindPDFLinks()
	if err != nil {
		return nil, fmt.Errorf("find PDF links: %w", err)
	}

	return links, nil
}

// download downloads PDFs from URLs
func (p *Pipeline) download(ctx context.Context, urls []string, brand string) ([]string, error) {
	var downloaded []string

	for i, url := range urls {
		if p.config.MaxDownloads > 0 && i >= p.config.MaxDownloads {
			break
		}

		path, err := p.downloader.DownloadFile(ctx, url, brand, "")
		if err != nil {
			p.logger.Warn("download failed", "url", url, "error", err)
			continue
		}

		downloaded = append(downloaded, path)
		p.logger.Debug("downloaded", "path", path)
	}

	return downloaded, nil
}

// index processes downloaded PDFs and indexes to Qdrant
func (p *Pipeline) index(ctx context.Context, pdfPaths []string, brand string) (int, error) {
	totalChunks := 0

	for _, pdfPath := range pdfPaths {
		metadata := map[string]string{
			"brand":  brand,
			"source": filepath.Dir(pdfPath),
		}

		chunks, err := p.chunker.ChunkFromPDF(pdfPath, metadata)
		if err != nil {
			p.logger.Warn("chunk failed", "path", pdfPath, "error", err)
			continue
		}

		for _, chunk := range chunks {
			// Generate embedding
			vector, err := p.embedder.Embed(ctx, chunk.Text)
			if err != nil {
				p.logger.Warn("embed failed", "chunk_id", chunk.ID, "error", err)
				continue
			}

			// Upsert to Qdrant
			payload := map[string]any{
				"brand":       chunk.Metadata["brand"],
				"model":       chunk.Metadata["model"],
				"section":     chunk.Section,
				"content_type": chunk.ContentType,
				"text":        chunk.Text,
			}

			if err := p.qdrant.UpsertPoint(ctx, chunk.ID, vector, payload); err != nil {
				p.logger.Warn("upsert failed", "chunk_id", chunk.ID, "error", err)
				continue
			}

			totalChunks++
		}

		p.logger.Info("indexed", "path", pdfPath, "chunks", len(chunks))
	}

	return totalChunks, nil
}

// Close releases all pipeline resources
func (p *Pipeline) Close() {
	if p.browser != nil {
		p.browser.Close()
	}
	if p.qdrant != nil {
		p.qdrant.Close()
	}
}
