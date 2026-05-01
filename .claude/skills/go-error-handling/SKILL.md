# Go Error Handling Skill

Structured error handling patterns for Go.

## Decision Framework

1. Does caller need to programmatically distinguish this error? Yes → sentinel or custom type
2. Is error a static string with no runtime context? Yes → `errors.New`
3. Does error carry structured data caller needs? Yes → custom error type

## Patterns

### 1. Sentinel Error
```go
var ErrNotFound = errors.New("user not found")

// Usage
if errors.Is(err, ErrNotFound) {
    // handle not found
}
```

### 2. Wrapped Error
```go
if err != nil {
    return fmt.Errorf("create user: %w", err)
}
```

### 3. Custom Error Type
```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// Check type
var ve *ValidationError
if errors.As(err, &ve) {
    fmt.Println(ve.Field)
}
```

### 4. Multi-Error Collection
```go
errs := []error{
    ErrNameRequired,
    ErrEmailInvalid,
}
return errors.Join(errs...)
```

## Anti-Patterns

- **Don't panic** — panic is for programmer bugs only
- **Don't ignore errors** — every `err` must be checked
- **Don't use string matching** — use `errors.Is`/`errors.As`
- **Don't over-wrap** — add useful context, not redundant function names
- **Don't log and return** — either log or return, never both

## Error as Last Return

```go
func GetUser(id string) (*User, error) {
    // ...
    return user, nil  // correct
}
```

## HTTP Handler Error Mapping

```go
func handleError(w http.ResponseWriter, err error) {
    switch {
    case errors.Is(err, ErrNotFound):
        http.Error(w, "not found", http.StatusNotFound)
    case errors.Is(err, ErrUnauthorized):
        http.Error(w, "unauthorized", http.StatusUnauthorized)
    default:
        http.Error(w, "internal error", http.StatusInternalServerError)
    }
}
```
