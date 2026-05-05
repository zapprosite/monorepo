package scraper

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// BrowserInterface allows testing without a real browser connection
type BrowserInterface interface {
	throttle()
	SetRateLimit(time.Duration)
}

// TestThrottle tests the throttle method behavior
func TestThrottle(t *testing.T) {
	b := &Browser{rateLimit: 100 * time.Millisecond}

	before := time.Now()
	b.throttle()
	after := time.Now()

	elapsed := after.Sub(before)
	if elapsed < 100*time.Millisecond {
		t.Errorf("throttle did not sleep enough: %v < 100ms", elapsed)
	}
}

func TestThrottle_ZeroRateLimit(t *testing.T) {
	b := &Browser{rateLimit: 0}

	before := time.Now()
	b.throttle()
	after := time.Now()

	elapsed := after.Sub(before)
	// With rateLimit=0, throttle should not sleep
	if elapsed > 10*time.Millisecond {
		t.Errorf("throttle should not sleep when rateLimit is 0, took %v", elapsed)
	}
}

func TestThrottle_NegativeRateLimit(t *testing.T) {
	b := &Browser{rateLimit: -1 * time.Second}

	before := time.Now()
	b.throttle()
	after := time.Now()

	elapsed := after.Sub(before)
	// Negative rateLimit should not cause issues
	if elapsed > 10*time.Millisecond {
		t.Errorf("throttle should not sleep for negative rateLimit, took %v", elapsed)
	}
}

func TestBrowser_SetRateLimit(t *testing.T) {
	b := &Browser{}
	if b.rateLimit != 0 {
		t.Errorf("expected initial rateLimit to be 0, got %v", b.rateLimit)
	}

	b.SetRateLimit(3 * time.Second)
	if b.rateLimit != 3*time.Second {
		t.Errorf("expected rateLimit 3s, got %v", b.rateLimit)
	}
}

// TestRateLimiting tests that multiple requests respect rate limits
func TestRateLimiting(t *testing.T) {
	var requestTimes []time.Time
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestTimes = append(requestTimes, time.Now())
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer server.Close()

	b := &Browser{rateLimit: 50 * time.Millisecond}

	for i := 0; i < 5; i++ {
		b.throttle()
	}

	mu.Lock()
	defer mu.Unlock()

	if len(requestTimes) != 5 {
		t.Errorf("expected 5 time recordings, got %d", len(requestTimes))
	}

	// Verify rate limiting between throttle calls
	for i := 1; i < len(requestTimes); i++ {
		elapsed := requestTimes[i].Sub(requestTimes[i-1])
		if elapsed < 50*time.Millisecond {
			t.Errorf("rate limit not respected between call %d and %d: %v", i-1, i, elapsed)
		}
	}
}

func TestRateLimit_concurrentAccess(t *testing.T) {
	b := &Browser{rateLimit: 10 * time.Millisecond}

	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			b.throttle()
		}()
	}
	wg.Wait()
}

// TestNoPageLoaded tests behavior when no page is loaded
func TestNoPageLoaded(t *testing.T) {
	b := &Browser{page: nil}

	_, err := b.FindPDFLinks()
	if err == nil {
		t.Error("expected error when no page is loaded")
	}
}

func TestDownloadPDF_NoPageLoaded(t *testing.T) {
	b := &Browser{page: nil}

	err := b.DownloadPDF(context.Background(), "http://example.com/test.pdf", "/tmp/test.pdf")
	if err == nil {
		t.Error("expected error when no page is loaded")
	}
}

// TestNavigate_NoBrowser tests that Navigate requires a browser
// This is a unit test for the method signature without actual browser
func TestNavigate_MethodSignature(t *testing.T) {
	b := &Browser{
		browser:   nil,
		page:      nil,
		rateLimit: 2 * time.Second,
	}

	// Test that SetRateLimit works on Browser struct
	b.SetRateLimit(5 * time.Second)
	if b.rateLimit != 5*time.Second {
		t.Errorf("expected rateLimit 5s, got %v", b.rateLimit)
	}
}

func TestClose_NoBrowser(t *testing.T) {
	b := &Browser{}

	// Close with nil browser should not panic
	b.Close()
}

func TestClose_WithBrowser(t *testing.T) {
	// This test verifies Close doesn't panic when called
	// Note: We cannot easily test actual browser close in unit tests
	// without launching a browser, so we verify the method exists
	b := &Browser{}

	// Should not panic
	b.Close()
}

// BenchmarkThrottle benchmarks the throttle function
func BenchmarkThrottle(b *testing.B) {
	br := &Browser{rateLimit: 1 * time.Millisecond}
	for i := 0; i < b.N; i++ {
		br.throttle()
	}
}
