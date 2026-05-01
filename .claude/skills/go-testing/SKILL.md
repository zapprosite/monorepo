# Go Testing Skill

Go testing patterns and best practices.

## Test File Naming

```
foo.go        → foo_test.go
foo_test.go  → foo_test_test.go (avoid)
```

## Table-Driven Tests

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name    string
        email   string
        wantErr bool
    }{
        {"valid email", "user@example.com", false},
        {"invalid without @", "userexample.com", true},
        {"invalid without domain", "user@", true},
        {"empty", "", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            err := validateEmail(tt.email)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

## Testify Usage

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestSomething(t *testing.T) {
    // require — stops test on failure
    require.NoError(t, err)

    // assert — continues test
    assert.Equal(t, expected, actual)
}
```

## Mock Patterns

```go
type MockRepo struct {
    mock.Mock
}

func (m *MockRepo) FindByID(id string) (*Entity, error) {
    args := m.Called(id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*Entity), args.Error(1)
}

func TestService(t *testing.T) {
    mockRepo := new(MockRepo)
    svc := NewService(mockRepo)

    mockRepo.On("FindByID", "123").Return(&Entity{ID: "123"}, nil)

    result, err := svc.Get("123")

    require.NoError(t, err)
    assert.Equal(t, "123", result.ID)
    mockRepo.AssertExpectations(t)
}
```

## Running Tests

```bash
# All tests
go test ./...

# Verbose
go test -v ./...

# Race detector
go test -race ./...

# Coverage
go test -cover -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Specific package
go test -v ./internal/service/...

# Specific test
go test -v -run "^TestCreate" ./...
```

## Best Practices

- `t.Parallel()` for independent tests
- `t.Cleanup()` for cleanup
- Test behavior, not implementation
- Use interfaces for testable design
- Factored setup functions for repeated logic
