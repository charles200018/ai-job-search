const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

function buildPrompt(resumeText) {
  return `Analyze the following resume and extract structured information.\n\nReturn JSON with the following keys:\n- skills (array of strings)\n- technologies (array of strings)\n- job_titles (array of strings)\n- years_experience (number or string)\n- preferred_roles (array of strings)\n\nOnly return valid JSON. Do not include any explanation text.\n\nResume text:\n${resumeText}`
}

function parseJsonFromModelResponse(content) {
  try {
    return JSON.parse(content)
  } catch {
    // Continue to fenced/substring parsing
  }

  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1])
    } catch {
      // Continue to brace slicing
    }
  }

  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = content.slice(firstBrace, lastBrace + 1)
    return JSON.parse(candidate)
  }

  throw new Error('Groq response was not valid JSON')
}

export async function analyzeResumeText(resumeText) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY in environment')
  }

  const body = {
    model: DEFAULT_GROQ_MODEL,
    messages: [
      {
        role: 'user',
        content: buildPrompt(resumeText)
      }
    ],
    temperature: 0.1
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groq API error: ${res.status} ${text}`)
  }

  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Groq API returned an empty response')
  }

  return parseJsonFromModelResponse(content)
}
