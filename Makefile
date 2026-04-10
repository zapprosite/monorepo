.PHONY: dev run build test smoke seed board

dev:
	docker compose -f deployments/docker-compose.local.yml up -d redis qdrant
	go run cmd/swarm/main.go

build:
	CGO_ENABLED=1 GOOS=linux go build -o bin/swarm cmd/swarm/main.go
	CGO_ENABLED=0 GOOS=linux go build -o bin/ingestion cmd/ingestion/main.go

test:
	go test ./... -v -race -cover

smoke:
	bash scripts/smoke_tests.sh http://localhost:8080

seed:
	go run cmd/ingestion/main.go --path=data/pdfs/

board:
	@echo "SSE Board: http://localhost:8080/api/swarm/board"
	curl -N http://localhost:8080/api/swarm/board

deploy-staging:
	docker compose -f deployments/docker-compose.staging.yml up -d --build

deploy-prod:
	docker compose -f deployments/docker-compose.prod.yml up -d --build
