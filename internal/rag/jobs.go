package rag

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Job state constants (BullMQ-style)
const (
	JobStateDelayed   = "delayed"
	JobStateWaiting  = "waiting"
	JobStateActive   = "active"
	JobStateCompleted = "completed"
	JobStateFailed    = "failed"
)

// Job type constants
const (
	JobTypeRAGQuery     = "rag_query"
	JobTypeIndexPDF     = "index_pdf"
	JobTypeEmbedChunks  = "embed_chunks"
)

// Redis key prefixes for job queue
const (
	QueuePrefix     = "rag:queue:"      // List: waiting jobs (RPUSH to add, BLPOP to consume)
	QueueDelayPrefix = "rag:delay:"     // Sorted Set: delayed jobs (score = timestamp to process)
	QueueDLQPrefix   = "rag:dlq:"       // List: dead letter queue
	JobPrefix        = "rag:job:"       // Hash: job data
)

// Default job configuration
const (
	DefaultMaxRetries  = 3
	DefaultBackoffMs   = 1000 // base backoff in ms (1s, 2s, 4s exponential)
)

// Job represents a job in the queue (stored as Redis Hash)
type Job struct {
	ID        string `json:"id"`
	Type      string `json:"type"`       // "rag_query" | "index_pdf" | "embed_chunks"
	State     string `json:"state"`
	Data      string `json:"data"`       // JSON payload
	Attempts  int    `json:"attempts"`
	MaxRetry  int    `json:"max_retry"`  // default 3
	Backoff   int    `json:"backoff"`    // exponential backoff in ms (1s, 2s, 4s)
	Error     string `json:"error,omitempty"`
	CreatedAt int64  `json:"created_at"` // Unix timestamp
}

// JobResult represents the result of processing a job
type JobResult struct {
	Data any
	Err  error
}

// JobHandler is a function that processes a job
type JobHandler func(ctx context.Context, job *Job) JobResult

// JobQueue provides BullMQ-style job queue operations using Redis
type JobQueue struct {
	rdb *redis.Client
}

// NewJobQueue creates a new JobQueue with the given Redis client
func NewJobQueue(rdb *redis.Client) *JobQueue {
	return &JobQueue{rdb: rdb}
}

// queueKey returns the waiting queue key for a job type
func queueKey(jobType string) string {
	return QueuePrefix + jobType
}

// delayKey returns the delay sorted set key for a job type
func delayKey(jobType string) string {
	return QueueDelayPrefix + jobType
}

// dlqKey returns the dead letter queue key for a job type
func dlqKey(jobType string) string {
	return QueueDLQPrefix + jobType
}

// jobKey returns the job hash key for a job ID
func jobKey(jobID string) string {
	return JobPrefix + jobID
}

// AddJob adds a job to the waiting queue and returns the job ID
func (q *JobQueue) AddJob(ctx context.Context, jobType string, data any) (string, error) {
	job := Job{
		ID:        uuid.New().String(),
		Type:      jobType,
		State:     JobStateWaiting,
		Attempts:  0,
		MaxRetry:  DefaultMaxRetries,
		Backoff:   DefaultBackoffMs,
		CreatedAt: time.Now().UnixMilli(),
	}

	// Marshal data and handle error
	dataStr, err := marshalData(data)
	if err != nil {
		return "", fmt.Errorf("marshal job data: %w", err)
	}
	job.Data = dataStr

	// Save job as Redis Hash
	jobMap := jobToMap(job)
	if err := q.rdb.HSet(ctx, jobKey(job.ID), jobMap).Err(); err != nil {
		return "", fmt.Errorf("hset job: %w", err)
	}

	// Add job ID to waiting queue (RPUSH)
	if err := q.rdb.RPush(ctx, queueKey(jobType), job.ID).Err(); err != nil {
		return "", fmt.Errorf("rpush job to queue: %w", err)
	}

	return job.ID, nil
}

// ProcessJobs consumes jobs from the queue and processes them with the given handler.
// It runs indefinitely until the context is cancelled.
// jobType specifies which queue to consume from.
func (q *JobQueue) ProcessJobs(ctx context.Context, jobType string, handler JobHandler) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Move any delayed jobs that are ready
		q.MoveDelayedJobs(ctx, jobType)

		// BLPOP with timeout to allow checking context periodically
		result, err := q.rdb.BLPop(ctx, 5*time.Second, queueKey(jobType)).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue // timeout, no job available
			}
			return fmt.Errorf("blpop: %w", err)
		}

		if len(result) < 2 {
			continue
		}

		jobID := result[1]

		// Get job from hash
		job, err := q.getJob(ctx, jobID)
		if err != nil {
			continue // job not found or corrupted
		}

		// Mark as active
		job.State = JobStateActive
		q.updateJob(ctx, job)

		// Process the job
		resultJob := handler(ctx, job)

		if resultJob.Err != nil && job.Attempts < job.MaxRetry {
			// Retry with exponential backoff
			if retryErr := q.retryJob(ctx, job, resultJob.Err); retryErr != nil {
				// If retry fails, move to DLQ
				q.moveToDLQ(ctx, job, resultJob.Err)
			}
		} else if resultJob.Err != nil {
			// Max retries exceeded, move to DLQ
			q.moveToDLQ(ctx, job, resultJob.Err)
		} else {
			// Mark as completed
			q.completeJob(ctx, job.ID)
		}
	}
}

// getJob retrieves a job from Redis Hash
func (q *JobQueue) getJob(ctx context.Context, jobID string) (*Job, error) {
	data, err := q.rdb.HGetAll(ctx, jobKey(jobID)).Result()
	if err != nil {
		return nil, fmt.Errorf("hgetall job: %w", err)
	}

	if len(data) == 0 {
		return nil, fmt.Errorf("job not found: %s", jobID)
	}

	return mapToJob(data)
}

// updateJob updates a job in Redis Hash
func (q *JobQueue) updateJob(ctx context.Context, job *Job) error {
	return q.rdb.HSet(ctx, jobKey(job.ID), jobToMap(*job)).Err()
}

// retryJob moves a failed job to the delay sorted set for exponential backoff retry
func (q *JobQueue) retryJob(ctx context.Context, job *Job, jobErr error) error {
	// Increment attempts
	job.Attempts++
	job.Error = jobErr.Error()

	// Calculate exponential backoff delay: backoff * 2^(attempts-1)
	// 1s, 2s, 4s for attempts 1, 2, 3
	delayMs := job.Backoff * (1 << (job.Attempts - 1))
	delayTime := time.Now().Add(time.Duration(delayMs) * time.Millisecond)

	// Update job state to delayed
	job.State = JobStateDelayed

	// Update job in hash
	if err := q.updateJob(ctx, job); err != nil {
		return fmt.Errorf("update job for retry: %w", err)
	}

	// Add to delay sorted set with score = timestamp to become available
	if err := q.rdb.ZAdd(ctx, delayKey(job.Type), redis.Z{
		Score:  float64(delayTime.UnixMilli()),
		Member: job.ID,
	}).Err(); err != nil {
		return fmt.Errorf("zadd to delay set: %w", err)
	}

	return nil
}

// moveToDLQ moves a job to the dead letter queue after max retries
func (q *JobQueue) moveToDLQ(ctx context.Context, job *Job, jobErr error) error {
	job.State = JobStateFailed
	job.Error = jobErr.Error()

	// Update job in hash
	if err := q.updateJob(ctx, job); err != nil {
		return fmt.Errorf("update job for DLQ: %w", err)
	}

	// Move job ID to DLQ (RPUSH to DLQ list)
	if err := q.rdb.RPush(ctx, dlqKey(job.Type), job.ID).Err(); err != nil {
		return fmt.Errorf("rpush to DLQ: %w", err)
	}

	return nil
}

// completeJob marks a job as completed and removes it from the job hash
func (q *JobQueue) completeJob(ctx context.Context, jobID string) error {
	job, err := q.getJob(ctx, jobID)
	if err != nil {
		return err
	}

	job.State = JobStateCompleted

	// Update job with completed state
	if err := q.updateJob(ctx, job); err != nil {
		return fmt.Errorf("update job completed: %w", err)
	}

	// Delete the job hash (completed jobs don't need persistence)
	return q.rdb.Del(ctx, jobKey(jobID)).Err()
}

// MoveDelayedJobs moves jobs whose delay has expired from delay sorted set to waiting queue
// This should be called periodically or can be integrated into the job processor loop
func (q *JobQueue) MoveDelayedJobs(ctx context.Context, jobType string) (int, error) {
	now := float64(time.Now().UnixMilli())

	// Get jobs from delay sorted set with score <= now
	jobIDs, err := q.rdb.ZRangeByScore(ctx, delayKey(jobType), &redis.ZRangeBy{
		Min:   "-inf",
		Max:   fmt.Sprintf("%f", now),
	}).Result()
	if err != nil {
		return 0, fmt.Errorf("zrangebyscore delay set: %w", err)
	}

	if len(jobIDs) == 0 {
		return 0, nil
	}

	// Move each job to the waiting queue
	for _, jobID := range jobIDs {
		// Remove from delay set
		if _, err := q.rdb.ZRem(ctx, delayKey(jobType), jobID).Result(); err != nil {
			continue
		}

		// Update job state to waiting
		job, err := q.getJob(ctx, jobID)
		if err != nil {
			continue
		}
		job.State = JobStateWaiting
		q.updateJob(ctx, job)

		// Add to waiting queue
		if err := q.rdb.RPush(ctx, queueKey(jobType), jobID).Err(); err != nil {
			continue
		}
	}

	return len(jobIDs), nil
}

// GetQueueLength returns the number of jobs in the waiting queue for a job type
func (q *JobQueue) GetQueueLength(ctx context.Context, jobType string) (int64, error) {
	return q.rdb.LLen(ctx, queueKey(jobType)).Result()
}

// GetDLQLength returns the number of jobs in the dead letter queue for a job type
func (q *JobQueue) GetDLQLength(ctx context.Context, jobType string) (int64, error) {
	return q.rdb.LLen(ctx, dlqKey(jobType)).Result()
}

// GetJob retrieves a job by ID
func (q *JobQueue) GetJob(ctx context.Context, jobID string) (*Job, error) {
	return q.getJob(ctx, jobID)
}

// jobToMap converts a Job to a map for Redis Hash storage
func jobToMap(job Job) map[string]interface{} {
	m := map[string]interface{}{
		"id":         job.ID,
		"type":       job.Type,
		"state":      job.State,
		"data":       job.Data,
		"attempts":   job.Attempts,
		"max_retry":  job.MaxRetry,
		"backoff":    job.Backoff,
		"created_at": job.CreatedAt,
	}
	if job.Error != "" {
		m["error"] = job.Error
	}
	return m
}

// mapToJob converts a map from Redis Hash to a Job
func mapToJob(m map[string]string) (*Job, error) {
	if m == nil {
		return nil, errors.New("nil map")
	}

	job := &Job{
		ID:    m["id"],
		Type:  m["type"],
		State: m["state"],
		Data:  m["data"],
	}
	if v, ok := m["error"]; ok {
		job.Error = v
	}

	if v, ok := m["attempts"]; ok {
		if n, err := strconv.Atoi(v); err == nil {
			job.Attempts = n
		}
	}
	if v, ok := m["max_retry"]; ok {
		if n, err := strconv.Atoi(v); err == nil {
			job.MaxRetry = n
		}
	}
	if v, ok := m["backoff"]; ok {
		if n, err := strconv.Atoi(v); err == nil {
			job.Backoff = n
		}
	}
	if v, ok := m["created_at"]; ok {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			job.CreatedAt = n
		}
	}

	return job, nil
}

// marshalData marshals data to JSON, returns error instead of panic
func marshalData(data any) (string, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("json marshal: %w", err)
	}
	return string(b), nil
}
