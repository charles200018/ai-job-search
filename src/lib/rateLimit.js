const rateLimitStores = new Map()

function getClientAddress(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown'
}

export function enforceRateLimit(req, res, {
  keyPrefix,
  limit,
  windowMs,
}) {
  const clientAddress = getClientAddress(req)
  const now = Date.now()
  const key = `${keyPrefix}:${clientAddress}`
  const existing = rateLimitStores.get(key)

  if (!existing || existing.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + windowMs,
    }
    rateLimitStores.set(key, nextEntry)
    res.setHeader('X-RateLimit-Limit', String(limit))
    res.setHeader('X-RateLimit-Remaining', String(limit - nextEntry.count))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(nextEntry.resetAt / 1000)))
    return
  }

  existing.count += 1
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(limit - existing.count, 0)))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)))

  if (existing.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    const error = new Error('Too many requests')
    error.statusCode = 429
    throw error
  }
}