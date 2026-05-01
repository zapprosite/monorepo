# Go Style Skill

Enforce Go coding style and formatting conventions.

## Formatting

- **Use `gofmt`** — run on save, no exceptions
- **Use `gofumpt`** for stricter formatting

```bash
gofmt -w .
gofumpt -l .
```

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variable | mixedCaps | `maxConnections` |
| Constant | MixedCaps | `MaxRetries` |
| Function | MixedCaps | `ProcessData` |
| Package | lowercase | `internal/user` |
| Interface | er-suffix | `Reader`, `Writer` |
| Error | Err prefix | `ErrNotFound` |
| Acronym | same case | `ID`, `API`, `HTTP` |

## Import Grouping

```go
import (
    // Standard library
    "context"
    "encoding/json"
    "fmt"

    // External packages
    "github.com/user/project/pkg"
    "go.uber.org/zap"

    // Internal packages
    "myproject/internal/domain"
)
```

## Comments

```go
// User represents a user entity in the system.
type User struct{}

// NewUser creates a new user with the given name.
// It returns an error if the name is empty.
func NewUser(name string) (*User, error) {
    if name == "" {
        return nil, fmt.Errorf("name required")
    }
    return &User{name: name}, nil
}
```

## Rules
- Document all exported symbols
- Use meaningful variable names (no `x`, `tmp`)
- Keep functions short (< 40 lines ideal)
- Prefer early returns (reduce nesting)
- Use struct field tags for JSON, validation
