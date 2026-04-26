package memory

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserKey(t *testing.T) {
	key := userKey("+5511999999999", "status")
	assert.Equal(t, "user:+5511999999999:status", key)
}

func TestGraphKey(t *testing.T) {
	key := graphKey("graph-123", "intent")
	assert.Equal(t, "state:graph-123:intent", key)
}

func TestRedisLayer_SetUserState(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	// Skip if Redis is not available
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	layer := NewRedisLayer(client)

	state := map[string]string{
		"status":            "trial_on",
		"requests_remaining": "7",
		"plan":              "trial",
	}

	err := layer.SetUserState(ctx, "+5511999999999", state)
	require.NoError(t, err)

	// Verify
	retrieved, err := layer.GetUserState(ctx, "+5511999999999")
	require.NoError(t, err)
	assert.Equal(t, "trial_on", retrieved["status"])
	assert.Equal(t, "7", retrieved["requests_remaining"])
	assert.Equal(t, "trial", retrieved["plan"])
}

func TestRedisLayer_GetUserState_NotFound(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	layer := NewRedisLayer(client)

	state, err := layer.GetUserState(ctx, "+0000000000")
	require.NoError(t, err)
	assert.Empty(t, state)
}

func TestRedisLayer_SetGraphState(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	layer := NewRedisLayer(client)

	state := map[string]interface{}{
		"intent": "diagnostic",
		"entities": map[string]string{
			"brand":      "Springer",
			"model":      "XC-9000",
			"btu":        "12000",
			"error_code": "E5",
		},
	}

	err := layer.SetGraphState(ctx, "graph-test-123", state)
	require.NoError(t, err)

	// Verify
	retrieved, err := layer.GetGraphState(ctx, "graph-test-123")
	require.NoError(t, err)
	assert.Equal(t, "diagnostic", retrieved["intent"])
}

func TestRedisLayer_IncrementCounter(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	layer := NewRedisLayer(client)
	phone := "+5511999999999"

	// Clean up first
	client.Del(ctx, userKey(phone, "total_requests"))

	// Increment
	val, err := layer.IncrementCounter(ctx, phone, "total_requests")
	require.NoError(t, err)
	assert.Equal(t, int64(1), val)

	// Increment again
	val, err = layer.IncrementCounter(ctx, phone, "total_requests")
	require.NoError(t, err)
	assert.Equal(t, int64(2), val)
}

func TestRedisLayer_AppendConversation(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	layer := NewRedisLayer(client)
	phone := "+5511999999999"

	// Clean up
	client.Del(ctx, userKey(phone, "conversation"))

	// Append messages
	msg1 := map[string]string{"role": "user", "content": "Olá"}
	msg2 := map[string]string{"role": "assistant", "content": "Oi, como posso ajudar?"}

	err := layer.AppendConversation(ctx, phone, msg1)
	require.NoError(t, err)

	err = layer.AppendConversation(ctx, phone, msg2)
	require.NoError(t, err)

	// Verify
	msgs, err := layer.GetConversation(ctx, phone)
	require.NoError(t, err)
	assert.Len(t, msgs, 2)
	assert.Equal(t, "user", msgs[0]["role"])
	assert.Equal(t, "Olá", msgs[0]["content"])
}

func TestRedisLayer_SetWithExpiry(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}
	defer client.Close()

	layer := NewRedisLayer(client)
	phone := "+5511999999999"

	// Set with short expiry
	err := layer.SetWithExpiry(ctx, phone, "tmp_key", "tmp_value", 100*time.Millisecond)
	require.NoError(t, err)

	// Verify it exists
	val, err := layer.GetInt(ctx, phone, "tmp_key")
	require.NoError(t, err)
	assert.Equal(t, int64(0), val) // String value, not int

	// Wait for expiry
	time.Sleep(200 * time.Millisecond)

	// Verify it expired
	val, err = layer.GetInt(ctx, phone, "tmp_key")
	require.NoError(t, err)
	assert.Equal(t, int64(0), val)
}

func TestRedisLayer_Close(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	layer := NewRedisLayer(client)
	assert.NotNil(t, layer.Client())

	err := layer.Close()
	assert.NoError(t, err)
}
