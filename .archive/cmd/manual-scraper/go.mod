module github.com/will-zappro/hvacr-swarm/cmd/manual-scraper

go 1.26.1

require (
	github.com/go-rod/rod v0.114.0
	github.com/will-zappro/hvacr-swarm v0.0.0
	golang.org/x/mod v0.32.0
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/ledongthuc/pdf v0.0.0-20250511090121-5959a4027728 // indirect
	github.com/qdrant/go-client v1.17.1 // indirect
	github.com/ysmood/fetchup v0.2.3 // indirect
	github.com/ysmood/goob v0.4.0 // indirect
	github.com/ysmood/got v0.34.1 // indirect
	github.com/ysmood/gson v0.7.3 // indirect
	github.com/ysmood/leakless v0.8.0 // indirect
	golang.org/x/net v0.50.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
	golang.org/x/text v0.34.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260209200024-4cfbd4190f57 // indirect
	google.golang.org/grpc v1.78.0 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
)

replace (
	github.com/will-zappro/hvacr-swarm => ../..
	github.com/will-zappro/hvacr-swarm/internal/circuitbreaker => ../../internal/circuitbreaker
	github.com/will-zappro/hvacr-swarm/internal/rag => ../../internal/rag
	github.com/will-zappro/hvacr-swarm/internal/rag/qdrant => ../../internal/rag/qdrant
)
