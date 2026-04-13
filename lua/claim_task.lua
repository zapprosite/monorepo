-- Atomic task claim for swarm workers
-- KEYS[1] = swarm:queue:{agent_type}
-- KEYS[2] = swarm:queue:{agent_type}:processing
-- ARGV[1] = worker_id
-- ARGV[2] = timestamp (unix ms)

local task_json = redis.call('RPOP', KEYS[1])
if task_json then
    local task = cjson.decode(task_json)
    task['status'] = 'running'
    task['worker_id'] = ARGV[1]
    task['claimed_at'] = ARGV[2]
    redis.call('HSET', KEYS[2], task['task_id'], cjson.encode(task))
    return cjson.encode(task)
end
return nil
