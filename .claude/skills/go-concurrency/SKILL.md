# Go Concurrency Skill

Safe concurrency patterns with goroutines, channels, and sync primitives.

## Decision Framework

| Use Channels When | Use Mutexes When |
|---|---|
| Passing ownership of data | Protecting internal state |
| Coordinating goroutines | Simple counter or flag |
| Distributing work | Short critical sections |
| Signaling events | Cache access |

## Goroutine Cleanup

```go
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

var wg sync.WaitGroup
for i := 0; i < n; i++ {
    wg.Add(1)
    go func(id int) {
        defer wg.Done()
        // work
    }(i)
}
wg.Wait()
```

## Worker Pool

```go
func workerPool(ctx context.Context, jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup

    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for job := range jobs {
                results <- process(job)
            }
        }(i)
    }

    wg.Wait()
    close(results)
}
```

## Pipeline Pattern

```go
func pipeline(ctx context.Context, gen func() <-chan int) <-chan int {
    out := make(chan int)

    go func() {
        defer close(out)
        for v := range gen() {
            select {
            case out <- v * v:
            case <-ctx.Done():
                return
            }
        }
    }()

    return out
}
```

## sync.Pool (Object Reuse)

```go
var pool = sync.Pool{
    New: func() interface{} {
        return &bytes.Buffer{}
    },
}

buf := pool.Get().(*bytes.Buffer)
defer pool.Put(buf)
buf.Reset()
```

## Common Mistakes

- **Never leak goroutines** — always have cleanup mechanism
- **Avoid `time.Sleep()` for sync** — use channels or `WaitGroup`
- **Don't forget `defer cancel()`** on context creation
- **Closing channels from sender only** — receiver must not close

## Race Detector

Always run tests with `-race`:
```bash
go test -race ./...
```
