FROM golang:1.23-alpine AS builder
RUN apk add --no-cache ca-certificates git
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o swarm ./cmd/swarm/main.go

FROM alpine
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/swarm /swarm
ENTRYPOINT ["/swarm"]
