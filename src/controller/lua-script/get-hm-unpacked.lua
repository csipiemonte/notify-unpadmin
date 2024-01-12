local queue_name = ARGV[1]
local result = {}

local keyvalues = redis.call("HSCAN",queue_name,0,'MATCH','*','COUNT',100)

for idx = 1, #keyvalues[2], 2 do
    if queue_name == "mb:coda:queues:messages" then
        result[keyvalues[2][idx]] = cmsgpack.unpack(keyvalues[2][idx + 1])
    else
        result[keyvalues[2][idx]] = keyvalues[2][idx + 1]
    end
end

return cjson.encode(result)
