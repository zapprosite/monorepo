package rag

import (
	"context"
	"log/slog"
)

// Span represents an observability span.
// Interface allows for no-op implementation when OTEL is not available.
type Span interface {
	End(err ...error)
	SetAttributes(attrs ...Attribute)
}

// Attribute represents a key-value trait for a span.
type Attribute struct {
	Key   string
	Value any
}

// RAGTracer handles span creation for RAG pipeline instrumentation.
type RAGTracer interface {
	// StartSpan creates a new span with the given name.
	StartSpan(ctx context.Context, name string, attrs ...Attribute) (context.Context, Span)
	// WithSpan wraps a function execution with a span.
	WithSpan(ctx context.Context, name string, attrs []Attribute, fn func(ctx context.Context) error) error
}

// noOpTracer is a no-operation tracer that logs spans without sending to OTEL.
type noOpTracer struct{}

// noOpSpan is a no-operation span for environments without OTEL.
type noOpSpan struct{}

// StartSpan implements RAGTracer.
func (n *noOpTracer) StartSpan(ctx context.Context, name string, attrs ...Attribute) (context.Context, Span) {
	// Log span creation for debugging using slog.Any for each attribute
	slog.Debug("span started",
		slog.String("span_name", name),
		slog.Any("attrs", attrs))
	return ctx, &noOpSpan{}
}

// WithSpan implements RAGTracer.
func (n *noOpTracer) WithSpan(ctx context.Context, name string, attrs []Attribute, fn func(ctx context.Context) error) error {
	ctx, span := n.StartSpan(ctx, name, attrs...)
	defer span.End()
	return fn(ctx)
}

// End implements Span.
func (n *noOpSpan) End(err ...error) {}

// SetAttributes implements Span.
func (n *noOpSpan) SetAttributes(attrs ...Attribute) {}

// OTELTracer is the OpenTelemetry-based tracer implementation.
// Build tag: otel
type OTELTracer struct {
	// tracer wraps the OpenTelemetry tracer.
	tracer interface {
		Start(ctx context.Context, name string, opts ...any) (context.Context, any)
		SetAttributes(ctx context.Context, attrs ...Attribute)
	}
}

// OTELSpan wraps an OpenTelemetry span.
type OTELSpan struct {
	ctx  context.Context
	span any // *trace.Span
}

// End implements Span.
func (s *OTELSpan) End(err ...error) {
	// Type assert and call End on the underlying span
	if span, ok := s.span.(interface{ End(err ...error) }); ok {
		span.End(err...)
	}
}

// SetAttributes implements Span.
func (s *OTELSpan) SetAttributes(attrs ...Attribute) {
	if span, ok := s.span.(interface {
		SetAttributes(attrs ...Attribute)
	}); ok {
		span.SetAttributes(attrs...)
	}
}

// StartSpan implements RAGTracer.
func (t *OTELTracer) StartSpan(ctx context.Context, name string, attrs ...Attribute) (context.Context, Span) {
	ctx, span := t.tracer.Start(ctx, name)
	return ctx, &OTELSpan{ctx: ctx, span: span}
}

// WithSpan implements RAGTracer.
func (t *OTELTracer) WithSpan(ctx context.Context, name string, attrs []Attribute, fn func(ctx context.Context) error) error {
	ctx, span := t.StartSpan(ctx, name, attrs...)
	defer span.End()
	return fn(ctx)
}

// Global RAG tracer instance.
// Defaults to noOpTracer; replaced by InitTracer when OTEL is configured.
var ragTracer RAGTracer = &noOpTracer{}

// InitTracer initializes the global RAG tracer.
// Call this once during application startup.
func InitTracer(t RAGTracer) {
	ragTracer = t
}

// SetTracerForTest replaces the global tracer (for testing only).
func SetTracerForTest(t RAGTracer) {
	ragTracer = t
}

// GetTracer returns the global RAG tracer.
func GetTracer() RAGTracer {
	return ragTracer
}

// --------------------------------------------------------------------------------
// Span wrapper functions for RAG pipeline
// --------------------------------------------------------------------------------

// WithSpan wraps a function execution with a span.
// Generic span wrapper that works with any Tracer implementation.
func WithSpan(ctx context.Context, name string, fn func(ctx context.Context) error) error {
	return ragTracer.WithSpan(ctx, name, nil, fn)
}

// WithSpanAttrs wraps a function execution with a span and attributes.
func WithSpanAttrs(ctx context.Context, name string, attrs []Attribute, fn func(ctx context.Context) error) error {
	return ragTracer.WithSpan(ctx, name, attrs, fn)
}

// TraceRAGQuery starts a span for the entire RAG query pipeline.
//
// Trace hierarchy:
//   - rag.query
//     ├── cache.lookup
//     ├── embed.query
//     ├── qdrant.search (dense)
//     ├── qdrant.search (sparse)
//     ├── qdrant.fusion (RRF)
//     └── llm.response
func TraceRAGQuery(ctx context.Context, query string) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "rag.query",
		Attribute{Key: "rag.query", Value: query},
	)
}

// TraceEmbed starts a span for embedding operation.
func TraceEmbed(ctx context.Context, count int) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "rag.embed",
		Attribute{Key: "rag.chunk_count", Value: count},
	)
}

// TraceSearch starts a span for Qdrant search operation.
func TraceSearch(ctx context.Context, collection string, limit int) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "rag.search",
		Attribute{Key: "rag.collection", Value: collection},
		Attribute{Key: "rag.limit", Value: limit},
	)
}

// TraceCacheLookup starts a span for semantic cache lookup.
func TraceCacheLookup(ctx context.Context, query string) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "cache.lookup",
		Attribute{Key: "rag.query", Value: query},
	)
}

// TraceQdrantDenseSearch starts a span for dense vector search.
func TraceQdrantDenseSearch(ctx context.Context, collection string, limit int) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "qdrant.search.dense",
		Attribute{Key: "rag.collection", Value: collection},
		Attribute{Key: "rag.limit", Value: limit},
		Attribute{Key: "rag.vector_type", Value: "dense"},
	)
}

// TraceQdrantSparseSearch starts a span for sparse vector search.
func TraceQdrantSparseSearch(ctx context.Context, collection string, limit int) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "qdrant.search.sparse",
		Attribute{Key: "rag.collection", Value: collection},
		Attribute{Key: "rag.limit", Value: limit},
		Attribute{Key: "rag.vector_type", Value: "sparse"},
	)
}

// TraceQdrantFusion starts a span for RRF fusion of search results.
func TraceQdrantFusion(ctx context.Context, denseCount, sparseCount int) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "qdrant.fusion",
		Attribute{Key: "rag.dense_hits", Value: denseCount},
		Attribute{Key: "rag.sparse_hits", Value: sparseCount},
	)
}

// TraceLLMResponse starts a span for LLM response generation.
func TraceLLMResponse(ctx context.Context) (context.Context, Span) {
	return ragTracer.StartSpan(ctx, "rag.llm.response")
}
