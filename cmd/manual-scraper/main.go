package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
)

var (
	urlFlag       = flag.String("url", "", "Single URL to scrape")
	configFlag    = flag.String("config", "", "YAML with source definitions")
	outputFlag    = flag.String("output", "./data/manuals", "Download directory")
	headlessFlag  = flag.Bool("headless", true, "Run browser headless")
	rateLimitFlag = flag.Duration("rate-limit", 2*time.Second, "Delay between requests")
	maxFlag       = flag.Int("max", 0, "Max downloads (0 = unlimited)")
	pipelineFlag  = flag.String("pipeline", "", "Run full pipeline for brand (lg,samsung,springer)")
	ollamaFlag    = flag.String("ollama", "http://localhost:11434", "Ollama API URL")
	qdrantFlag    = flag.String("qdrant", "10.0.19.2:6333", "Qdrant address")
	verboseFlag   = flag.Bool("verbose", false, "Enable verbose logging")
)

func main() {
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle interrupts gracefully
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)
	go func() {
		<-sigCh
		log.Println("Received interrupt, shutting down...")
		cancel()
	}()

	// Ensure output directory exists
	if err := os.MkdirAll(*outputFlag, 0755); err != nil {
		log.Fatalf("Failed to create output directory: %v", err)
	}

	// Route based on command
	switch {
	case *urlFlag != "":
		if err := scrapeSingle(ctx, *urlFlag); err != nil {
			log.Fatalf("Scrape failed: %v", err)
		}
	case *configFlag != "":
		if err := batchScrape(ctx, *configFlag); err != nil {
			log.Fatalf("Batch scrape failed: %v", err)
		}
	case *pipelineFlag != "":
		if err := runPipeline(ctx, *pipelineFlag); err != nil {
			log.Fatalf("Pipeline failed: %v", err)
		}
	case flag.NArg() > 0 && flag.Arg(0) == "pipeline":
		sources := flag.Arg(1) // e.g., "lg,samsung,springer"
		if err := runPipeline(ctx, sources); err != nil {
			log.Fatalf("Pipeline failed: %v", err)
		}
	default:
		flag.Usage()
		log.Println("\nCommands:")
		log.Println("  scrape --url URL              Scrape single URL")
		log.Println("  batch --config FILE           Batch scrape from YAML")
		log.Println("  pipeline --pipeline BRAND     Full pipeline (lg,samsung,springer)")
		log.Println("\nExamples:")
		log.Println("  ./manual-scraper --pipeline lg")
		log.Println("  ./manual-scraper --config sources.yaml --max 10")
	}
}

func scrapeSingle(ctx context.Context, url string) error {
	log.Printf("Starting single URL scrape: %s", url)

	// Launch browser with Rod (--no-sandbox required for Linux root/containers)
	u := launcher.New().Headless(true).Set("no-sandbox", "").Set("disable-dev-shm-usage", "").MustLaunch()
	browser := rod.New().ControlURL(u).MustConnect()
	defer browser.MustClose()

	page := browser.MustPage()
	defer page.Close()

	// Navigate to URL
	page.MustNavigate(url).MustWaitLoad()

	log.Printf("Successfully loaded page: %s", page.MustInfo().URL)
	return nil
}

func batchScrape(ctx context.Context, configPath string) error {
	log.Printf("Starting batch scrape from: %s", configPath)

	sources, err := LoadSources(configPath)
	if err != nil {
		return fmt.Errorf("load sources: %w", err)
	}

	log.Printf("Loaded %d sources", len(sources))

	for _, source := range sources {
		log.Printf("Source: %s (%s)", source.Name, source.Brand)
		// TODO: Implement batch scraping per source
	}

	return nil
}

func runPipeline(ctx context.Context, sources string) error {
	log.Printf("Starting full pipeline for sources: %s", sources)
	sourceList := strings.Split(sources, ",")
	log.Printf("Sources to process: %v", sourceList)

	// Load default sources if not provided
	cfg := PipelineConfig{
		OutputDir:    *outputFlag,
		OllamaURL:    *ollamaFlag,
		QdrantAddr:   *qdrantFlag,
		RateLimit:    *rateLimitFlag,
		MaxDownloads: *maxFlag,
		Verbose:      *verboseFlag,
	}

	pipeline, err := NewPipeline(cfg)
	if err != nil {
		return fmt.Errorf("create pipeline: %w", err)
	}
	defer pipeline.Close()

	// Load sources from config or use defaults
	var srcs []Source
	if *configFlag != "" {
		srcs, err = LoadSources(*configFlag)
		if err != nil {
			return fmt.Errorf("load sources: %w", err)
		}
	} else {
		// Use default sources
		srcs = getDefaultSources()
	}

	for _, sourceName := range sourceList {
		for _, source := range srcs {
			if source.Brand == sourceName || source.Name == sourceName {
				if err := pipeline.Run(ctx, source); err != nil {
					log.Printf("Pipeline failed for %s: %v", sourceName, err)
					continue
				}
			}
		}
	}

	return nil
}

func getDefaultSources() []Source {
	return []Source{
		{Name: "lg", URL: "https://www.lg.com/br/suporte/manuais", Brand: "lg", Type: "split"},
		{Name: "samsung", URL: "https://www.samsung.com/br/support/manuals/", Brand: "samsung", Type: "split"},
		{Name: "springer", URL: "https://www.springer.com.br/suporte/", Brand: "springer", Type: "split"},
	}
}