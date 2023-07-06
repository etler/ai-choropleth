import Redis from "ioredis"
import NodeCache from "node-cache"

export abstract class Cache {
  abstract get(key: string): Promise<string | null>
  abstract set(key: string, value: string, ttl?: number): Promise<void>
}

export class RedisCache extends Cache {
  client: Redis
  constructor(client: Redis) {
    super()
    this.client = client
  }
  get(key: string): Promise<string | null> {
    return this.client.get(key)
  }
  set(key: string, value: string, ttl?: number): Promise<void> {
    return (ttl ? this.client.set(key, value, "EX", ttl) : this.client.set(key, value)).then(() => {
      return
    })
  }
}

export class MemoryCache extends Cache {
  client: NodeCache
  constructor(client: NodeCache) {
    super()
    this.client = client
  }
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.client.get(key) || null)
  }
  /**
   * Set cache key to value
   * @param key cache lookup key
   * @param value cache stored value
   * @param ttl time to live in seconds
   * @returns void promise indicating successfulness
   */
  set(key: string, value: string, ttl?: number): Promise<void> {
    const ok = ttl ? this.client.set(key, value, ttl) : this.client.set(key, value)
    if (ok) {
      return Promise.resolve()
    } else {
      throw new Error(`Cache Error: Could not set "${key}": "${value}"`)
    }
  }
}

export class NoCache extends Cache {
  get(): Promise<string | null> {
    return Promise.resolve(null)
  }
  set(): Promise<void> {
    return Promise.resolve()
  }
}
