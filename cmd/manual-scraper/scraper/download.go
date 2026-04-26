package scraper

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

// Downloader handles PDF file downloads
type Downloader struct {
	client    *http.Client
	outputDir string
	rateLimit time.Duration
	lastReq   time.Time
}

// NewDownloader creates a new downloader
func NewDownloader(outputDir string) *Downloader {
	return &Downloader{
		client: &http.Client{
			Timeout: 60 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return nil // Allow redirects
			},
		},
		outputDir: outputDir,
		rateLimit: 2 * time.Second,
	}
}

// SetRateLimit sets the delay between downloads
func (d *Downloader) SetRateLimit(duration time.Duration) {
	d.rateLimit = duration
}

// DownloadFile downloads a file from URL to output path
func (d *Downloader) DownloadFile(ctx context.Context, fileURL string, brand string, model string) (string, error) {
	d.throttle()

	// Create brand directory
	brandDir := path.Join(d.outputDir, brand)
	if err := os.MkdirAll(brandDir, 0755); err != nil {
		return "", fmt.Errorf("create brand dir: %w", err)
	}

	// Determine filename
	u, err := url.Parse(fileURL)
	if err != nil {
		return "", fmt.Errorf("parse URL: %w", err)
	}

	filename := path.Base(u.Path)
	if !strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		filename = model + ".pdf"
	}

	outputPath := path.Join(brandDir, filename)

	// Check if already exists
	if _, err := os.Stat(outputPath); err == nil {
		return outputPath, nil // Already downloaded
	}

	// Download
	req, err := http.NewRequestWithContext(ctx, "GET", fileURL, nil)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; HVAC-Scraper/1.0)")

	resp, err := d.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	// Save to temp file first, then move
	tmpPath := outputPath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		os.Remove(tmpPath)
		return "", fmt.Errorf("write file: %w", err)
	}

	f.Close()
	os.Rename(tmpPath, outputPath)

	return outputPath, nil
}

// throttle respects rate limits
func (d *Downloader) throttle() {
	elapsed := time.Since(d.lastReq)
	if elapsed < d.rateLimit {
		time.Sleep(d.rateLimit - elapsed)
	}
	d.lastReq = time.Now()
}
