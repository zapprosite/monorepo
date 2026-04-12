# Write API Spec Skill

Generate a structured API specification document from a feature description.

## Usage

```
/write-api-spec <feature description>
```

## Output

Creates `docs/specflow/SPEC-XXX-api.md` with:
- Endpoint definition (method, path, auth)
- Request format (headers, query params, body)
- Response format (success + error cases)
- Go interface definitions
- Acceptance criteria checklist

## Template

```markdown
# API Specification: [Feature Name]

## Endpoint
- **Method:** [GET|POST|PUT|DELETE]
- **Path:** [path]
- **Auth:** [type]

## Request
### Headers
| Header | Type | Required |

### Query Parameters
| Param | Type | Default |

### Body
```json
{
  "field": "type"
}
```

## Response
### [Status Code]
```json
{
  "data": {}
}
```

### Errors
| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid input |

## Go Interfaces
```go
type Request struct {
    Field string `json:"field"`
}

type Response struct {
    Data interface{} `json:"data"`
}
```

## Acceptance Criteria
- [ ] Criterion 1
```

## Process

1. Parse feature description
2. Identify resource and operations
3. Define request/response shapes
4. Write Go interfaces
5. List acceptance criteria
