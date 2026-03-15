import { requireAuthenticatedUser } from '../../../src/lib/apiAuth.js'
import { processResumeUpload } from '../../../src/lib/resumeWorkflow.js'

export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authenticatedUser = await requireAuthenticatedUser(req)
    const payload = await processResumeUpload(req, authenticatedUser)
    return res.status(200).json(payload)
  } catch (error) {
    console.error(error)
    return res.status(error.statusCode || 500).json({ error: error.message || 'Resume matching failed' })
  }
}