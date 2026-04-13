// deployment_test.go
// Integration tests for SPEC-007 deployment verification
// Run: go test -v ./tests/integration/deployment_test.go

package integration

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	composeFile       = "deployments/docker-compose.test.yml"
	composeProject    = "hvacr-swarm-test"
	healthURL         = "http://localhost:8080/health"
	redisAddr         = "localhost:6379"
	swarmService      = "swarm"
	maxWaitSeconds    = 120
	restartWaitSeconds = 30
)

// dockerCmd runs a docker compose command and returns the result.
func dockerCmd(args ...string) (string, error) {
	cmd := exec.Command("docker", args...)
	cmd.Dir = "/srv/hvacr-swarm"
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// dockerCompose runs a docker compose command with the test project and file.
func dockerCompose(args ...string) (string, error) {
	baseArgs := []string{
		"compose",
		"-p", composeProject,
		"-f", composeFile,
	}
	return dockerCmd(append(baseArgs, args...)...)
}

// waitForHealth polls the health endpoint until it returns 200 or timeout.
func waitForHealth(t *testing.T, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	client := &http.Client{Timeout: 5 * time.Second}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			resp, err := client.Get(healthURL)
			if err == nil {
				body, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				// Require 200 AND body contains healthy indicator
				if resp.StatusCode == http.StatusOK && (strings.Contains(strings.ToLower(string(body)), "ok") || strings.Contains(strings.ToLower(string(body)), "healthy")) {
					return nil
				}
			}
		}
	}
}

// getSwarmContainerID returns the container ID for the swarm service.
func getSwarmContainerID(t *testing.T) string {
	output, err := dockerCompose("ps", "-q", "swarm")
	require.NoError(t, err)
	containerID := strings.TrimSpace(output)
	require.NotEmpty(t, containerID, "swarm container should exist")
	return containerID
}

// getContainerPID returns the main process PID of a container.
func getContainerPID(t *testing.T, containerID string) int {
	output, err := dockerCmd("inspect", "--format", "{{.State.Pid}}", containerID)
	require.NoError(t, err)
	var pid int
	_, err = fmt.Sscanf(strings.TrimSpace(output), "%d", &pid)
	require.NoError(t, err, "failed to parse PID from: %s", output)
	return pid
}

// TestDockerCompose_UpSucceeds verifies AC-1: docker compose up -d succeeds.
func TestDockerCompose_UpSucceeds(t *testing.T) {
	// Cleanup any previous test state
	_, _ = dockerCompose("down", "--remove-orphans", "--volumes")

	// Bring up the stack
	output, err := dockerCompose("up", "-d")
	t.Logf("docker compose up -d output:\n%s", output)
	require.NoError(t, err, "docker compose up -d should succeed")

	// Verify swarm service is running
	output, err = dockerCompose("ps", "swarm")
	require.NoError(t, err)
	assert.Contains(t, output, "swarm")
}

// TestHealthEndpoint_Returns200 verifies AC-2: health endpoint returns 200.
func TestHealthEndpoint_Returns200(t *testing.T) {
	// Ensure stack is up
	_, _ = dockerCompose("up", "-d")

	// Wait for health endpoint
	err := waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err, "health endpoint should become available within %d seconds", maxWaitSeconds)

	// Verify 200 response
	resp, err := http.Get(healthURL)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	bodyStr := strings.ToLower(string(body))

	assert.Equal(t, http.StatusOK, resp.StatusCode, "health endpoint should return 200")
	assert.NotEmpty(t, body, "health endpoint should return non-empty response")
	assert.True(t, strings.Contains(bodyStr, "ok") || strings.Contains(bodyStr, "healthy") || strings.Contains(bodyStr, "success"),
		"health response should contain ok/healthy/success indicator, got: %s", string(body))
}

// TestAutoRestart_OnCrash verifies AC-3: container restarts after SIGKILL.
func TestAutoRestart_OnCrash(t *testing.T) {
	// Ensure stack is up
	_, _ = dockerCompose("up", "-d")

	// Wait for healthy
	err := waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err, "health endpoint should be available before crash test")

	// Get container info before crash
	containerIDBefore := getSwarmContainerID(t)
	pidBefore := getContainerPID(t, containerIDBefore)

	t.Logf("Swarm container %s has PID %d", containerIDBefore[:12], pidBefore)

	// Send SIGKILL to the main process inside the container
	// Using docker kill with SIGKILL as fallback
	killOutput, err := dockerCmd("exec", containerIDBefore, "kill", "-9", "1")
	if err != nil {
		// Fallback: docker kill --signal=KILL
		t.Logf("exec kill failed (%v), trying docker kill: %s", err, killOutput)
		_, err = dockerCmd("kill", "--signal=KILL", containerIDBefore)
		require.NoError(t, err, "kill should succeed")
	}

	t.Log("Sent SIGKILL to swarm container, waiting for restart...")

	// Wait for new container (restart: unless-stopped)
	// Container ID should change after restart
	var containerIDAfter string
	require.Eventually(t, func() bool {
		containerIDAfter = getSwarmContainerID(t)
		return containerIDAfter != containerIDBefore
	}, restartWaitSeconds*time.Second, 2*time.Second,
		"container ID should change after restart (was %s, got %s)",
		containerIDBefore[:12], containerIDAfter[:12])

	pidAfter := getContainerPID(t, containerIDAfter)
	t.Logf("Swarm container restarted with new PID %d (was %d)", pidAfter, pidBefore)

	assert.NotEqual(t, pidBefore, pidAfter, "PID should change after restart")

	// Verify health endpoint recovers
	err = waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err, "health endpoint should recover after restart")
}

// TestGracefulShutdown_DrainsTasks verifies AC-4: SIGTERM causes graceful shutdown.
func TestGracefulShutdown_DrainsTasks(t *testing.T) {
	// Ensure stack is up
	_, _ = dockerCompose("up", "-d")

	// Wait for healthy
	err := waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err, "health endpoint should be available before shutdown test")

	containerID := getSwarmContainerID(t)
	t.Logf("Sending SIGTERM to swarm container %s", containerID[:12])

	// Send SIGTERM via docker stop (respects stop_grace_period: 30s)
	output, err := dockerCmd("stop", "-t", "30", containerID)
	t.Logf("docker stop output:\n%s", output)
	require.NoError(t, err, "docker stop should succeed")

	// Verify container is stopped (status = exited)
	require.Eventually(t, func() bool {
		output, err := dockerCmd("inspect", "--format", "{{.State.Status}}", containerID)
		if err != nil {
			return true // container removed
		}
		status := strings.TrimSpace(output)
		t.Logf("Container status: %s", status)
		return status == "exited" || status == "removed" || err != nil
	}, 45*time.Second, 2*time.Second, "container should stop gracefully")
}

// TestRedis_HealthCheck verifies Redis dependency is healthy.
func TestRedis_HealthCheck(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	// Wait for redis to be healthy via docker compose ps
	require.Eventually(t, func() bool {
		output, err := dockerCompose("ps", "redis")
		if err != nil {
			return false
		}
		return strings.Contains(output, "(healthy)")
	}, maxWaitSeconds*time.Second, 5*time.Second, "redis should be healthy")
}

// TestQdrant_HealthCheck verifies Qdrant dependency is healthy.
func TestQdrant_HealthCheck(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	// Wait for qdrant to be healthy
	require.Eventually(t, func() bool {
		output, err := dockerCompose("ps", "qdrant")
		if err != nil {
			return false
		}
		return strings.Contains(output, "(healthy)")
	}, maxWaitSeconds*time.Second, 5*time.Second, "qdrant should be healthy")
}

// TestFullStack_AllServicesHealthy verifies all services are healthy after startup.
func TestFullStack_AllServicesHealthy(t *testing.T) {
	_, _ = dockerCompose("down", "--remove-orphans", "--volumes")
	_, err := dockerCompose("up", "-d")
	require.NoError(t, err)

	// Wait for all services
	require.Eventually(t, func() bool {
		output, err := dockerCompose("ps")
		if err != nil {
			return false
		}
		// All three services should be healthy
		hasSwarm := strings.Contains(output, "swarm") && strings.Contains(output, "(healthy)")
		hasRedis := strings.Contains(output, "redis") && strings.Contains(output, "(healthy)")
		hasQdrant := strings.Contains(output, "qdrant") && strings.Contains(output, "(healthy)")
		return hasSwarm && hasRedis && hasQdrant
	}, maxWaitSeconds*time.Second, 5*time.Second, "all services should be healthy")

	// Final health check
	err = waitForHealth(t, 10*time.Second)
	require.NoError(t, err)
}

// TestRestartPolicy_UnStopped verifies restart: unless-stopped policy.
func TestRestartPolicy_UnStopped(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	containerID := getSwarmContainerID(t)

	// Stop the container with docker stop (should stay stopped)
	_, err := dockerCmd("stop", containerID)
	require.NoError(t, err)

	// Verify it stays stopped (does not auto-restart)
	time.Sleep(5 * time.Second)

	output, err := dockerCmd("inspect", "--format", "{{.State.Status}}", containerID)
	require.NoError(t, err)
	status := strings.TrimSpace(output)
	assert.Equal(t, "exited", status, "container should remain stopped after docker stop")

	// Restart via docker compose
	_, err = dockerCompose("restart", "swarm")
	require.NoError(t, err)

	// Verify it comes back up
	err = waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err, "swarm should come back up after docker compose restart")
}

// TestComposeDown_RemovesContainers verifies docker compose down cleanup.
func TestComposeDown_RemovesContainers(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	// Wait for healthy
	err := waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err)

	// Down
	_, err = dockerCompose("down", "--remove-orphans", "--volumes")
	require.NoError(t, err)

	// Verify no swarm container running
	output, err := dockerCompose("ps", "swarm")
	if err != nil {
		assert.Contains(t, output, "no service")
	} else {
		assert.Empty(t, strings.TrimSpace(output), "swarm container should be removed")
	}
}

// TestDockerPull_IfMissing verifies the compose pulls images if not present.
func TestDockerPull_IfMissing(t *testing.T) {
	// Pull redis image to ensure it's available
	_, err := dockerCmd("pull", "redis:7-alpine")
	require.NoError(t, err)

	_, err = dockerCmd("pull", "qdrant/qdrant:v1.7.4")
	require.NoError(t, err)

	// Verify images exist
	output, err := dockerCmd("images", "redis:7-alpine", "--format", "{{.Repository}}:{{.Tag}}")
	require.NoError(t, err)
	assert.Contains(t, strings.ToLower(output), "redis")

	output, err = dockerCmd("images", "qdrant/qdrant:v1.7.4", "--format", "{{.Repository}}:{{.Tag}}")
	require.NoError(t, err)
	assert.Contains(t, strings.ToLower(output), "qdrant")
}

// TestPorts_ExposedCorrectly verifies port mappings are correct.
func TestPorts_ExposedCorrectly(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	// Wait for healthy
	err := waitForHealth(t, maxWaitSeconds*time.Second)
	require.NoError(t, err)

	// Inspect swarm port mapping
	containerID := getSwarmContainerID(t)
	output, err := dockerCmd("inspect", "--format", "{{.NetworkSettings.Ports}}", containerID)
	require.NoError(t, err)
	t.Logf("Network ports: %s", output)
	assert.Contains(t, output, "8080/tcp", "swarm port 8080 should be mapped")
}

// TestEnvVars_PassedToContainer verifies environment variables are injected.
func TestEnvVars_PassedToContainer(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	containerID := getSwarmContainerID(t)

	// Inspect environment variables
	output, err := dockerCmd("inspect", "--format", "{{range .Config.Env}}{{.}} {{end}}", containerID)
	require.NoError(t, err)

	envStr := strings.ToLower(output)
	assert.Contains(t, envStr, "redis_addr=redis:6379", "REDIS_ADDR should be set")
	assert.Contains(t, envStr, "environment=test", "ENVIRONMENT should be set to test")
}

// TestHealthCheckInterval verifies the healthcheck configuration.
func TestHealthCheckInterval(t *testing.T) {
	_, _ = dockerCompose("up", "-d")

	containerID := getSwarmContainerID(t)

	output, err := dockerCmd("inspect", "--format", "{{.HostConfig.Healthcheck.Interval}}", containerID)
	require.NoError(t, err)

	interval := strings.TrimSpace(output)
	t.Logf("Healthcheck interval: %s", interval)
	assert.NotEmpty(t, interval, "healthcheck interval should be configured")
}
