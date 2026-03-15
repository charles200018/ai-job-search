import { requireAuthenticatedUser } from '../../../src/lib/apiAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await requireAuthenticatedUser(req)
    return res.status(200).json({ user })
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Authentication failed' })
  }
}
