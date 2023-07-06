import { Cache, MemoryCache, NoCache, RedisCache } from "@/utils/Cache"
import Redis from "ioredis"
import NodeCache from "node-cache"

const cache: Cache =
  process.env.NO_CACHE === "true"
    ? new NoCache()
    : process.env.REDIS_URL
    ? new RedisCache(new Redis(process.env.REDIS_URL))
    : new MemoryCache(new NodeCache())

const getCache = (): Cache => cache

export default getCache
