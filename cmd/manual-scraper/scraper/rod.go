package scraper

import (
	"context"
	"fmt"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
)

// Browser handles browser automation for HVAC manual scraping
type Browser struct {
	browser   *rod.Browser
	page      *rod.Page
	rateLimit time.Duration
}

// NewBrowser creates a new Rod browser instance
func NewBrowser(headless bool) (*Browser, error) {
	browser := rod.New()

	u := launcher.New().Headless(true).MustLaunch()
	browser = rod.New().ControlURL(u)

	if err := browser.MustConnect(); err != nil {
		return nil, fmt.Errorf("connect to browser: %w", err)
	}

	return &Browser{
		browser:   browser,
		rateLimit: 2 * time.Second,
	}, nil
}

// SetRateLimit sets the delay between requests
func (b *Browser) SetRateLimit(d time.Duration) {
	b.rateLimit = d
}

// Close closes the browser
func (b *Browser) Close() {
	b.browser.MustClose()
}

// Navigate opens a URL and waits for content to load
func (b *Browser) Navigate(ctx context.Context, url string) error {
	b.throttle()

	page := b.browser.MustPage(url)
	page.MustWaitLoad()
	b.page = page
	return nil
}

// FindPDFLinks finds all PDF links on the current page
func (b *Browser) FindPDFLinks() ([]string, error) {
	if b.page == nil {
		return nil, fmt.Errorf("no page loaded")
	}

	els := b.page.MustElements("a[href$='.pdf']")
	var links []string
	for _, el := range els {
		href, err := el.Attribute("href")
		if err == nil && href != nil {
			links = append(links, *href)
		}
	}
	return links, nil
}

// DownloadPDF downloads a PDF from a link
func (b *Browser) DownloadPDF(ctx context.Context, url string, outputPath string) error {
	b.throttle()

	page := b.page
	if page == nil {
		return fmt.Errorf("no page loaded")
	}

	// Find and click the PDF link
	el, err := page.Element(fmt.Sprintf(`a[href="%s"]`, url))
	if err != nil {
		return fmt.Errorf("find PDF link: %w", err)
	}
	el.MustClick()

	// Note: Full download implementation requires handling CDP download events
	// For now, the HTTP downloader in download.go handles direct PDF downloads
	return nil
}

func (b *Browser) throttle() {
	if b.rateLimit > 0 {
		time.Sleep(b.rateLimit)
	}
}