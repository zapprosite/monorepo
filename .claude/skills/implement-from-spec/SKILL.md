# Implement From Spec Skill

Implement Go code strictly from an approved specification document.

## Usage

```
/implement-from-spec <spec-file.md>
```

## Workflow

1. **Read the spec** — understand requirements
2. **Create types** — request/response DTOs, domain entities
3. **Create errors** — sentinel + custom types
4. **Implement core logic** — service layer
5. **Implement repository** — data access
6. **Implement handler** — HTTP handlers
7. **Run verification** — `go vet`, `go build`, `go test`

## Phased Implementation

### Phase 1: Types
```go
// internal/api/v1/user/types.go
type CreateRequest struct {
    Name  string `json:"name" validate:"required,max=100"`
    Email string `json:"email" validate:"required,email"`
}

type Response struct {
    ID    string `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

### Phase 2: Errors
```go
// internal/domain/user/errors.go
var ErrNotFound = errors.New("user not found")

type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}
```

### Phase 3: Core Logic
```go
// internal/service/user/service.go
func (s *Service) Create(ctx context.Context, req *CreateRequest) (*Response, error) {
    if req.Name == "" {
        return nil, &ValidationError{Field: "name", Message: "required"}
    }
    // ...
}
```

### Phase 4: Repository
```go
// internal/repository/user/repository.go
type Repository interface {
    Create(ctx context.Context, user *User) error
    GetByID(ctx context.Context, id string) (*User, error)
}
```

### Phase 5: Handler
```go
// internal/handler/user/handler.go
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    var req CreateRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    // ...
}
```

## Verification Per File

```bash
go vet ./internal/...
go build ./cmd/...
```

Commit only after all phases complete and all checks pass.

## Rules
- Follow spec exactly — no additions
- Run checks after each file
- Use table-driven tests
- Document all exported symbols
