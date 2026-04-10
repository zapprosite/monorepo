package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"refrimix/hvacr-swarm/internal/swarm"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// TODO: Load config
	// TODO: Connect to Redis
	// TODO: Load agents.json
	// TODO: Spawn workers
	// TODO: Start controller (scheduler + watchdog + rebalancer)
	// TODO: Start HTTP server

	log.Println("Swarm starting...")
	<-ctx.Done()
	log.Println("Swarm shutting down...")
}
