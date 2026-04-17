package rag

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache key prefix for RAG semantic cache
const CacheKeyPrefix = "rag:cache:"

// DefaultCacheTTL is the default time-to-live for cached responses
const DefaultCacheTTL = 24 * time.Hour

// SemanticCache provides query-level caching to avoid redundant embed + LLM calls.
type SemanticCache struct {
	rdb *redis.Client
	ttl time.Duration
}

// CachedResponse represents a cached RAG response.
type CachedResponse struct {
	Response       string   `json:"response"`
	SourceChunkIDs []string `json:"source_chunk_ids"`
	Confidence     float64  `json:"confidence"`
	CachedAt       int64    `json:"cached_at"` // Unix timestamp
}

// NewSemanticCache creates a new SemanticCache with the given Redis client.
func NewSemanticCache(rdb *redis.Client) *SemanticCache {
	return &SemanticCache{
		rdb: rdb,
		ttl: DefaultCacheTTL,
	}
}

// NewSemanticCacheWithTTL creates a new SemanticCache with a custom TTL.
func NewSemanticCacheWithTTL(rdb *redis.Client, ttl time.Duration) *SemanticCache {
	return &SemanticCache{
		rdb: rdb,
		ttl: ttl,
	}
}

// Get retrieves a cached response for the given query.
// Returns the cached response and true if found, or nil and false on cache miss.
func (c *SemanticCache) Get(ctx context.Context, query string) (*CachedResponse, bool, error) {
	key := c.cacheKey(query)

	val, err := c.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, false, nil // cache miss
	}
	if err != nil {
		return nil, false, fmt.Errorf("redis get: %w", err)
	}

	var resp CachedResponse
	if err := json.Unmarshal([]byte(val), &resp); err != nil {
		return nil, false, fmt.Errorf("unmarshal cached response: %w", err)
	}

	return &resp, true, nil
}

// Set stores a response in the cache with the configured TTL.
func (c *SemanticCache) Set(ctx context.Context, query string, resp *CachedResponse) error {
	key := c.cacheKey(query)

	resp.CachedAt = time.Now().UnixMilli()

	data, err := json.Marshal(resp)
	if err != nil {
		return fmt.Errorf("marshal response: %w", err)
	}

	if err := c.rdb.Set(ctx, key, data, c.ttl).Err(); err != nil {
		return fmt.Errorf("redis set: %w", err)
	}

	return nil
}

// Delete removes a query from the cache.
func (c *SemanticCache) Delete(ctx context.Context, query string) error {
	key := c.cacheKey(query)
	return c.rdb.Del(ctx, key).Err()
}

// InvalidateAll removes all entries from the RAG cache.
func (c *SemanticCache) InvalidateAll(ctx context.Context) error {
	pattern := CacheKeyPrefix + "*"

	var cursor uint64
	for {
		keys, nextCursor, err := c.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("redis scan: %w", err)
		}

		if len(keys) > 0 {
			if err := c.rdb.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("redis del: %w", err)
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return nil
}

// cacheKey generates a Redis key for a query.
func (c *SemanticCache) cacheKey(query string) string {
	hash := sha256Hash(normalizeQuery(query))
	return CacheKeyPrefix + hash
}

// sha256Hash returns the hex-encoded SHA-256 hash of a string.
func sha256Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// normalizeQuery normalizes a query for consistent caching.
// Lowercase, trim spaces, remove trailing punctuation.
func normalizeQuery(query string) string {
	// Lowercase
	s := strings.ToLower(query)

	// Trim whitespace
	s = strings.TrimSpace(s)

	// Remove trailing punctuation
	s = strings.TrimRight(s, ".,!?;:")

	// Collapse multiple spaces
	s = collapseSpaces(s)

	return s
}

// collapseSpaces replaces multiple consecutive spaces with a single space.
func collapseSpaces(s string) string {
	var result strings.Builder
	var lastSpace bool

	for _, r := range s {
		if r == ' ' {
			if !lastSpace {
				result.WriteRune(r)
				lastSpace = true
			}
		} else {
			result.WriteRune(r)
			lastSpace = false
		}
	}

	return result.String()
}

// CacheStats holds cache statistics.
type CacheStats struct {
	Keys    int64   `json:"keys"`
	Hits    int64   `json:"hits"`
	Misses  int64   `json:"misses"`
	HitRate float64 `json:"hit_rate"`
}

// GetStats returns cache statistics.
// Note: This is an approximation since Redis doesn't track hit/miss natively
// without additional instrumentation. Returns key count as a proxy metric.
func (c *SemanticCache) GetStats(ctx context.Context) (*CacheStats, error) {
	pattern := CacheKeyPrefix + "*"

	var count int64
	var cursor uint64
	for {
		keys, nextCursor, err := c.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, fmt.Errorf("redis scan: %w", err)
		}

		count += int64(len(keys))
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return &CacheStats{
		Keys: count,
	}, nil
}
