import 'dotenv/config'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY in environment')
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embedText(text) {
  // Use text-embedding-3-small or text-embedding-3-large depending on needs
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  const res = await openai.embeddings.create({ model, input: text })
  const vec = res.data[0].embedding
  return vec
}
