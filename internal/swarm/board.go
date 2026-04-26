package swarm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// BoardHandler handles SSE dashboard endpoints.
type BoardHandler struct {
	redis    *RedisClient
	registry *AgentRegistry
}

// NewBoardHandler creates a new BoardHandler.
func NewBoardHandler(redis *RedisClient, registry *AgentRegistry) *BoardHandler {
	return &BoardHandler{
		redis:    redis,
		registry: registry,
	}
}

// RegisterRoutes registers board SSE routes.
func (h *BoardHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/swarm/board", h.handleSSEBoard)
	mux.HandleFunc("GET /api/swarm/board/snapshot", h.handleSnapshot)
	mux.HandleFunc("GET /api/swarm/graphs/{id}", h.handleGraphStatus)
}

// BoardEvent represents an SSE event.
type BoardEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
	TS      int64       `json:"ts"`
}

func (h *BoardHandler) handleSSEBoard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ctx := r.Context()

	pubsub := h.redis.Subscribe(ctx, "swarm:events:task_completed", "swarm:events:agent_status", "swarm:events:graph_done")
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			event := BoardEvent{
				Type:    msg.Channel,
				Payload: msg.Payload,
				TS:      time.Now().UnixMilli(),
			}
			data, _ := json.Marshal(event)
			fmt.Fprintf(w, "data: %s\n\n", data)
			w.(http.Flusher).Flush()
		}
	}
}

func (h *BoardHandler) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	snapshot := map[string]interface{}{
		"workers": h.registry.Workers(),
		"graphs":  h.registry.Graphs(),
		"ts":      time.Now().UnixMilli(),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snapshot)
}

func (h *BoardHandler) handleGraphStatus(w http.ResponseWriter, r *http.Request) {
	// Placeholder - return empty graph status
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"graph_id": "",
		"status":   "unknown",
		"ts":       time.Now().UnixMilli(),
	})
}
