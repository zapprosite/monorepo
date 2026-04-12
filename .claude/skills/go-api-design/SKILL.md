# Go API Design Skill

REST API design patterns for Go.

## Project Structure

```
internal/
  api/
    v1/
      user/
        handler.go
        middleware.go
        routes.go
  service/
    user/
      service.go
  domain/
    user/
      entity.go
      repository.go
```

## HTTP Handler Pattern

```go
type Handler struct {
    svc user.Service
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    var req CreateRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request", http.StatusBadRequest)
        return
    }

    resp, err := h.svc.Create(r.Context(), &req)
    if err != nil {
        handleError(w, err)
        return
    }

    json.NewEncoder(w).Encode(resp)
}

func handleError(w http.ResponseWriter, err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        http.Error(w, "not found", http.StatusNotFound)
    case errors.Is(err, ErrValidation):
        http.Error(w, err.Error(), http.StatusBadRequest)
    default:
        http.Error(w, "internal error", http.StatusInternalServerError)
    }
}
```

## Middleware Chain

```go
func main() {
    r := http.NewServeMux()

    r.HandleFunc("POST /users", withAuth(withLogging(handler.Create)))
}

func withLogging(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        slog.Info("request",
            slog.String("method", r.Method),
            slog.String("path", r.URL.Path),
            slog.Duration("latency", time.Since(start)),
        )
    }
}
```

## Request Validation

```go
type CreateRequest struct {
    Name  string `json:"name" validate:"required,max=100"`
    Email string `json:"email" validate:"required,email"`
}

func (r *CreateRequest) Validate() error {
    if r.Name == "" {
        return errors.New("name required")
    }
    if !strings.Contains(r.Email, "@") {
        return errors.New("invalid email")
    }
    return nil
}
```

## Router Options

Go 1.22+ built-in:
```go
router.HandleFunc("GET /users/{id}/", getUser)
router.HandleFunc("POST /users/", createUser)
```

Chi router for middleware chains:
```go
r := chi.NewRouter()
r.Use(middleware.Logger)
r.Route("/api/v1", func(r chi.Router) {
    r.Post("/users/", handler.Create)
})
```

## Health Endpoints

```go
func healthHandler(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
    if err := db.Ping(r.Context()); err != nil {
        http.Error(w, "not ready", http.StatusServiceUnavailable)
        return
    }
    json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}
```
