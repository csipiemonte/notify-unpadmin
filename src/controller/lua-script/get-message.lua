local queue_name = ARGV[1]
local amount = ARGV[2]
local score = ARGV[3]
local result = {}
local function d(o)
 local result = nil
 if o then
   result = cjson.encode(cmsgpack.unpack(o))
   end
  return result
end
--local hashset = "mb:coda:queues:messages"
local hashset = ""
if string.match(queue_name, "dead") then
  hashset = string.gsub("mb:coda:queues:" .. queue_name,":[A-z]+:dead$","") .. ":dead"
else
  hashset = string.gsub("mb:coda:queues:" .. queue_name,":[A-z]+$","")
end

if string.match(queue_name, "to_be_retried") then
     hashset = string.gsub(hashset,":[A-z]+$","")
end

local uuid = redis.call("zrangebyscore", "mb:queues:" .. queue_name,score,score,'limit',0,amount) or "x"

for i=1,table.getn(uuid) do
	local m = d(redis.call("hget",hashset,uuid[i]))
	if m then
	  table.insert(result,m)
	end
end

return result
