local id = ARGV[1]
local hashmaps = {"mb:coda:queues:messages", "mb:counter:queues:messages"}
local queues = {"mb:queues:messages:io", "mb:queues:messages:sms","mb:queues:messages:email","mb:queues:messages:push","mb:queues:messages:mex"}
local queues_priority = {"mb:queues:messages:io_priority", "mb:queues:messages:sms_priority","mb:queues:messages:email_priority","mb:queues:messages:push_priority","mb:queues:messages:mex_priority"}

local result = {}

for i,queue in ipairs(queues) do
  result[queue] = redis.call("LREM",queue,1,id)
  result[queue..":to_be_retried"] = redis.call("LREM",queue..":to_be_retried",1,id)
end
for i,queue in ipairs(queues_priority) do
  result[queue] = redis.call("LREM",queue,1,id)
  result[queue..":to_be_retried"] = redis.call("LREM",queue..":to_be_retried",1,id)
end

for i, map in ipairs(hashmaps) do
  redis.call("HDEL",map,id)
  redis.call("HDEL",map.."to_be_retried",id)
end

return cjson.encode(result)