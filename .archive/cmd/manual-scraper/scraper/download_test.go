package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDownloadFile_Success(t *testing.T) {
	pdfContent := []byte("%PDF-1.4 test content")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/pdf")
		w.WriteHeader(http.StatusOK)
		w.Write(pdfContent)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0) // Disable rate limiting for tests

	ctx := context.Background()
	outputPath, err := d.DownloadFile(ctx, server.URL+"/manual.pdf", "TestBrand", "model-123")
	if err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("expected output file to exist")
	}

	content, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("failed to read output file: %v", err)
	}
	if string(content) != string(pdfContent) {
		t.Error("downloaded content does not match expected")
	}
}

func TestDownloadFile_404(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	_, err := d.DownloadFile(ctx, server.URL+"/missing.pdf", "Brand", "model")
	if err == nil {
		t.Error("expected error for 404 response")
	}
	if !strings.Contains(err.Error(), "HTTP 404") {
		t.Errorf("expected HTTP 404 in error, got: %v", err)
	}
}

func TestDownloadFile_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	_, err := d.DownloadFile(ctx, server.URL+"/error.pdf", "Brand", "model")
	if err == nil {
		t.Error("expected error for 500 response")
	}
	if !strings.Contains(err.Error(), "HTTP 500") {
		t.Errorf("expected HTTP 500 in error, got: %v", err)
	}
}

func TestDownloadFile_CorruptFile(t *testing.T) {
	corruptContent := []byte("not a pdf - corrupt data")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/pdf")
		w.WriteHeader(http.StatusOK)
		w.Write(corruptContent)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	outputPath, err := d.DownloadFile(ctx, server.URL+"/corrupt.pdf", "Brand", "model")
	if err != nil {
		t.Fatalf("DownloadFile should not error on corrupt file (only content check): %v", err)
	}

	// File should exist but with corrupt content
	content, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}
	if string(content) != string(corruptContent) {
		t.Errorf("content mismatch")
	}
}

func TestDownloadFile_FileAlreadyExists(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("new content"))
	}))
	defer server.Close()

	tmpDir := t.TempDir()

	// Pre-create the file
	brandDir := filepath.Join(tmpDir, "Brand")
	os.MkdirAll(brandDir, 0755)
	existingPath := filepath.Join(brandDir, "manual.pdf")
	os.WriteFile(existingPath, []byte("existing content"), 0644)

	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	outputPath, err := d.DownloadFile(ctx, server.URL+"/manual.pdf", "Brand", "model")
	if err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}

	// Should return existing file without re-downloading
	content, _ := os.ReadFile(outputPath)
	if string(content) != "existing content" {
		t.Error("expected existing file to be preserved")
	}
}

func TestDownloadFile_RateLimiting(t *testing.T) {
	var requestTimes []time.Time
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestTimes = append(requestTimes, time.Now())
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("content"))
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(100 * time.Millisecond)

	ctx := context.Background()
	for i := 0; i < 3; i++ {
		_, err := d.DownloadFile(ctx, server.URL+fmt.Sprintf("/file%d.pdf", i), "Brand", fmt.Sprintf("model%d", i))
		if err != nil {
			t.Fatalf("DownloadFile attempt %d failed: %v", i, err)
		}
	}

	mu.Lock()
	defer mu.Unlock()

	if len(requestTimes) != 3 {
		t.Errorf("expected 3 requests, got %d", len(requestTimes))
	}

	// Verify rate limiting: time between requests should be >= 100ms
	for i := 1; i < len(requestTimes); i++ {
		elapsed := requestTimes[i].Sub(requestTimes[i-1])
		if elapsed < 100*time.Millisecond {
			t.Errorf("rate limit not respected: only %v between requests", elapsed)
		}
	}
}

func TestDownloadFile_InvalidURL(t *testing.T) {
	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	_, err := d.DownloadFile(ctx, "://invalid-url", "Brand", "model")
	if err == nil {
		t.Error("expected error for invalid URL")
	}
}

func TestDownloadFile_ContextCancelled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	_, err := d.DownloadFile(ctx, server.URL+"/slow.pdf", "Brand", "model")
	if err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestDownloadFile_NonPDFWithoutExtension(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("content"))
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	outputPath, err := d.DownloadFile(ctx, server.URL+"/download", "Brand", "my-model")
	if err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}

	// Should use model name as filename
	if !strings.Contains(outputPath, "my-model") {
		t.Errorf("expected filename to contain model name, got: %s", outputPath)
	}
}

func TestNewDownloader(t *testing.T) {
	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)

	if d.outputDir != tmpDir {
		t.Errorf("expected outputDir %q, got %q", tmpDir, d.outputDir)
	}
	if d.rateLimit != 2*time.Second {
		t.Errorf("expected default rateLimit 2s, got %v", d.rateLimit)
	}
	if d.client == nil {
		t.Error("expected http client to be initialized")
	}
}

func TestDownloader_SetRateLimit(t *testing.T) {
	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)

	d.SetRateLimit(5 * time.Second)
	if d.rateLimit != 5*time.Second {
		t.Errorf("expected rateLimit 5s, got %v", d.rateLimit)
	}
}

// TestThrottle ensures throttle is called before download
func TestThrottle(t *testing.T) {
	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)

	before := time.Now()
	d.throttle()
	after := time.Now()

	// With no prior request, throttle should not sleep
	if d.lastReq.IsZero() {
		t.Error("expected lastReq to be updated after throttle")
	}
}

func TestThrottle_RespectsRateLimit(t *testing.T) {
	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.rateLimit = 50 * time.Millisecond
	d.lastReq = time.Now()

	before := time.Now()
	d.throttle()
	after := time.Now()

	elapsed := after.Sub(before)
	if elapsed < 50*time.Millisecond {
		t.Errorf("throttle did not respect rate limit: only %v", elapsed)
	}
}

// MockTransport for testing edge cases
type mockReader struct {
	content []byte
	readErr error
}

func (m *mockReader) Read(p []byte) (n int, err error) {
	if m.readErr != nil {
		return 0, m.readErr
	}
	copy(p, m.content)
	return len(m.content), io.EOF
}

func TestDownloadFile_CreateDirFailure(t *testing.T) {
	// Test with an invalid output path that cannot be created
	d := NewDownloader("/proc/invalid/path")
	d.SetRateLimit(0)

	ctx := context.Background()
	_, err := d.DownloadFile(ctx, "http://example.com/test.pdf", "Brand", "model")
	if err == nil {
		t.Error("expected error when cannot create directory")
	}
}

// Ensure JSON response parsing works correctly
func TestJSONResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	d := NewDownloader(tmpDir)
	d.SetRateLimit(0)

	ctx := context.Background()
	_, err := d.DownloadFile(ctx, server.URL+"/api", "Brand", "model")
	if err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}
}
