-- Worker heartbeat with 15s TTL
-- KEYS[1] = swarm:agents:heartbeat:{worker_id}
-- ARGV[1] = TTL in seconds (15)

redis.call('SETEX', KEYS[1], ARGV[1], 'alive')
return 1
