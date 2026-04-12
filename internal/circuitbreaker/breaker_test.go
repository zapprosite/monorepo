package circuitbreaker

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCircuitBreaker_ClosedState(t *testing.T) {
	cb := New(3, time.Second)

	// Initially closed
	assert.Equal(t, StateClosed, cb.GetState())

	// Successful calls keep it closed
	err := cb.Call(func() error { return nil })
	assert.NoError(t, err)
	assert.Equal(t, StateClosed, cb.GetState())
}

func TestCircuitBreaker_OpensOnThreshold(t *testing.T) {
	cb := New(3, time.Second)

	// 3 failures should open the circuit
	cb.Call(func() error { return errors.New("fail 1") })
	cb.Call(func() error { return errors.New("fail 2") })
	cb.Call(func() error { return errors.New("fail 3") })

	assert.Equal(t, StateOpen, cb.GetState())

	// Call should be rejected
	err := cb.Call(func() error { return nil })
	assert.ErrorIs(t, err, ErrCircuitOpen)
}

func TestCircuitBreaker_HalfOpenOnTimeout(t *testing.T) {
	cb := New(2, 50*time.Millisecond)

	// Open the circuit
	cb.Call(func() error { return errors.New("fail 1") })
	cb.Call(func() error { return errors.New("fail 2") })
	assert.Equal(t, StateOpen, cb.GetState())

	// Wait for timeout
	time.Sleep(60 * time.Millisecond)

	// Should transition to half-open on next call
	err := cb.Call(func() error { return nil })
	assert.NoError(t, err)
	// Note: successful call in half-open transitions to closed
	assert.Equal(t, StateClosed, cb.GetState())
}

func TestCircuitBreaker_HalfOpenFailsOnError(t *testing.T) {
	cb := New(2, 50*time.Millisecond)

	// Open the circuit with 2 failures
	cb.Call(func() error { return errors.New("fail") })
	cb.Call(func() error { return errors.New("fail") })
	assert.Equal(t, StateOpen, cb.GetState())

	// Wait for timeout
	time.Sleep(60 * time.Millisecond)

	// Transition to half-open (first call after timeout with success)
	err := cb.Call(func() error { return nil })
	assert.NoError(t, err)
	assert.Equal(t, StateClosed, cb.GetState()) // success in half-open -> closed

	// Now we need to re-open the circuit to test failure in half-open
	// Re-open with 2 failures (threshold is 2)
	cb.Call(func() error { return errors.New("fail1") })
	cb.Call(func() error { return errors.New("fail2") })
	assert.Equal(t, StateOpen, cb.GetState())

	// Wait for timeout again
	time.Sleep(60 * time.Millisecond)

	// First call in half-open: success
	err = cb.Call(func() error { return nil })
	assert.NoError(t, err)
	assert.Equal(t, StateClosed, cb.GetState())

	// Re-open again
	cb.Call(func() error { return errors.New("f1") })
	cb.Call(func() error { return errors.New("f2") })
	assert.Equal(t, StateOpen, cb.GetState())

	time.Sleep(60 * time.Millisecond)

	// First call in half-open: failure -> goes back to open
	err = cb.Call(func() error { return errors.New("fail in half-open") })
	assert.Error(t, err)
	assert.Equal(t, StateOpen, cb.GetState())
}

func TestCircuitBreaker_ResetOnSuccess(t *testing.T) {
	cb := New(3, time.Second)

	// Some failures
	cb.Call(func() error { return errors.New("fail") })
	assert.Equal(t, 1, cb.GetFailures())

	// Success resets
	err := cb.Call(func() error { return nil })
	assert.NoError(t, err)
	assert.Equal(t, 0, cb.GetFailures())
	assert.Equal(t, StateClosed, cb.GetState())
}
