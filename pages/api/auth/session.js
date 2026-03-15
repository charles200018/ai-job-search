import { requireAuthenticatedUser } from '../../../src/lib/apiAuth.js'
import { enforceRateLimit } from '../../../src/lib/rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    enforceRateLimit(req, res, { keyPrefix: 'auth-session', limit: 20, windowMs: 60 * 1000 })
    const user = await requireAuthenticatedUser(req)
    return res.status(200).json({ user })
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Authentication failed' })
  }
}
