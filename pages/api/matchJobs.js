import { requireAuthenticatedUser } from '../../src/lib/apiAuth.js'
import { enforceRateLimit } from '../../src/lib/rateLimit.js'
import { matchJobsBySkills } from '../../src/lib/resumeWorkflow.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    enforceRateLimit(req, res, { keyPrefix: 'match-jobs', limit: 30, windowMs: 5 * 60 * 1000 })
    const authenticatedUser = await requireAuthenticatedUser(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const requestedSkills = Array.isArray(body.skills) ? body.skills : []
    const fallbackSkills = Array.isArray(body.analysis?.skills) ? body.analysis.skills : []
    const skills = requestedSkills.length > 0 ? requestedSkills : fallbackSkills

    if (skills.length === 0) {
      return res.status(400).json({ error: 'Provide skills to match jobs' })
    }

    const matches = await matchJobsBySkills(skills)
    await Promise.resolve(authenticatedUser)

    return res.status(200).json({ matches })
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Job matching failed' })
  }
}
