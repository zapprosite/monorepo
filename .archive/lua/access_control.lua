-- Atomic access control check + decrement
-- KEYS[1] = user:{phone}:requests_remaining

local remaining = redis.call('GET', KEYS[1])
if remaining == nil or tonumber(remaining) <= 0 then
    return cjson.encode({decision="block", remaining=0})
end
redis.call('DECR', KEYS[1])
local new_remaining = redis.call('GET', KEYS[1])
return cjson.encode({decision="allow", remaining=tonumber(new_remaining)})
