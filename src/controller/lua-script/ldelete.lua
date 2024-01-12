local queue_name = ARGV[1]
local uuid = ARGV[2]

local counter = string.gsub(queue_name,":([A-z]+)",":counter:%1",1)
if not string.find(queue_name, "to_be_retried")
then
    counter = string.gsub(counter,":[A-z]+$","")
end

--local uuid = redis.call("lindex",queue_name,index) or "x"

local hashset = string.gsub(queue_name,":([A-z]+)",":coda:%1",1)
if not string.find(queue_name, "to_be_retried")
then
    hashset = string.gsub(hashset,":[A-z]+$","")
end


local c = redis.call('HINCRBY', counter, uuid, -1)
if c <= 0 then
  redis.call('HDEL', hashset, uuid)
  redis.call('HDEL', counter, uuid)
end


return redis.call("lrem",queue_name,1,uuid)