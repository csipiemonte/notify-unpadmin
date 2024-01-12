local queue_name = ARGV[1]
local index = ARGV[2]

local counter = string.gsub(queue_name,":([A-z]+)",":counter:%1",1)
counter = string.gsub(counter,":[A-z]+$","")

local uuid = redis.call("lrange", queue_name,0,index) or "x"

local hashset = string.gsub(queue_name,":([A-z]+)",":coda:%1",1)
hashset = string.gsub(hashset,":[A-z]+$","")

for i=1,table.getn(uuid) do
	local c = redis.call('HINCRBY', counter, uuid[i], -1)
	if c <= 0 then
      redis.call('HDEL', hashset, uuid[i])
      redis.call('HDEL', counter, uuid[i])
    end
end


return redis.call("lrem",queue_name,1,redis.call("lindex",queue_name,index))