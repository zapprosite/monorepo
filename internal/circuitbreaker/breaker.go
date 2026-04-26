package circuitbreaker

import (
	"errors"
	"log/slog"
	"sync"
	"time"
)

// State represents the state of the circuit breaker.
type State int

const (
	// StateClosed means the circuit breaker is operating normally.
	StateClosed State = iota
	// StateOpen means the circuit breaker is blocking calls.
	StateOpen
	// StateHalfOpen means the circuit breaker is testing if the service is recovered.
	StateHalfOpen
)

// ErrCircuitOpen is returned when the circuit breaker is open.
var ErrCircuitOpen = errors.New("circuit breaker is open")

// CircuitBreaker implements a 3-state circuit breaker pattern.
type CircuitBreaker struct {
	mu        sync.RWMutex
	state     State
	failures  int
	threshold int
	timeout   time.Duration
	lastTry   time.Time
	logger    *slog.Logger
}

// New creates a new CircuitBreaker with the given threshold and timeout.
// threshold: number of failures before opening the circuit
// timeout: duration before attempting to close the circuit (transition to half-open)
func New(threshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:     StateClosed,
		failures:  0,
		threshold: threshold,
		timeout:   timeout,
		lastTry:   time.Now(),
		logger:    slog.Default(),
	}
}

// NewWithLogger creates a new CircuitBreaker with a custom logger.
func NewWithLogger(threshold int, timeout time.Duration, logger *slog.Logger) *CircuitBreaker {
	return &CircuitBreaker{
		state:     StateClosed,
		failures:  0,
		threshold: threshold,
		timeout:   timeout,
		lastTry:   time.Now(),
		logger:    logger,
	}
}

// Call executes the provided function if the circuit is closed.
// Returns ErrCircuitOpen if the circuit is open.
// On success: transitions half-open -> closed
// On failure: increments failure count, opens circuit if threshold reached
func (b *CircuitBreaker) Call(fn func() error) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Check if we should transition from open to half-open
	if b.state == StateOpen {
		if time.Since(b.lastTry) >= b.timeout {
			b.state = StateHalfOpen
			b.logger.Info("circuit breaker state change", "from", "open", "to", "half-open")
		} else {
			return ErrCircuitOpen
		}
	}

	// Execute the function
	err := fn()

	if err != nil {
		// Record failure
		b.failures++
		if b.state == StateHalfOpen {
			// Half-open -> open on failure
			b.state = StateOpen
			b.lastTry = time.Now()
			b.logger.Warn("circuit breaker state change", "from", "half-open", "to", "open", "reason", "half-open request failed")
		} else if b.failures >= b.threshold {
			// Closed -> open on threshold
			b.state = StateOpen
			b.lastTry = time.Now()
			b.logger.Warn("circuit breaker state change", "from", "closed", "to", "open", "reason", "threshold exceeded", "failures", b.failures)
		}
		return err
	}

	// Success
	if b.state == StateHalfOpen {
		// Half-open -> closed on success
		b.state = StateClosed
		b.failures = 0
		b.logger.Info("circuit breaker state change", "from", "half-open", "to", "closed")
	} else if b.failures > 0 {
		// Reset failures on success in closed state
		b.failures = 0
	}

	return nil
}

// GetState returns the current state of the circuit breaker.
func (b *CircuitBreaker) GetState() State {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.state
}

// GetFailures returns the current failure count.
func (b *CircuitBreaker) GetFailures() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.failures
}
