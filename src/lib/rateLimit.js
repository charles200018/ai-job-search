import { Redis } from '@upstash/redis'

const rateLimitStores = new Map()
let redisClient

function getClientAddress(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown'
}

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    redisClient = null
    return redisClient
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

async function enforceDistributedRateLimit(key, windowMs) {
  const redis = getRedisClient()
  if (!redis) {
    return null
  }

  const count = await redis.incr(key)
  let ttl = await redis.pttl(key)

  if (count === 1 || ttl < 0) {
    await redis.pexpire(key, windowMs)
    ttl = windowMs
  }

  return {
    count,
    resetAt: Date.now() + Math.max(ttl, 0),
    backend: 'redis',
  }
}

function enforceInMemoryRateLimit(key, windowMs) {
  const now = Date.now()
  const existing = rateLimitStores.get(key)

  if (!existing || existing.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + windowMs,
      backend: 'memory',
    }
    rateLimitStores.set(key, nextEntry)
    return nextEntry
  }

  existing.count += 1
  return existing
}

export async function enforceRateLimit(req, res, {
  keyPrefix,
  limit,
  windowMs,
}) {
  const clientAddress = getClientAddress(req)
  const key = `${keyPrefix}:${clientAddress}`
  const now = Date.now()
  const current = await enforceDistributedRateLimit(key, windowMs) || enforceInMemoryRateLimit(key, windowMs)

  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(limit - current.count, 0)))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)))
  res.setHeader('X-RateLimit-Backend', current.backend)

  if (current.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    const error = new Error('Too many requests')
    error.statusCode = 429
    throw error
  }
}