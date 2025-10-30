/**
 * Client OpenAI centralisé
 */

import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY

// Créer le client OpenAI uniquement si la clé est présente
export const openai = apiKey ? new OpenAI({ apiKey }) : null

if (!apiKey) {
  console.warn('⚠️  OPENAI_API_KEY not found - Agents will run in mock mode')
  console.warn('💡 To enable AI agents, add OPENAI_API_KEY to your environment variables')
}

// ========================================
// HELPERS
// ========================================

export async function chat(
  systemPrompt: string,
  userMessage: string,
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
  } = {}
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.')
  }

  const {
    model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature = 0.7,
    maxTokens = 4000,
  } = options

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
  })

  return response.choices[0]?.message?.content || ''
}

export async function chatWithJSON<T = any>(
  systemPrompt: string,
  userMessage: string,
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<T> {
  const response = await chat(systemPrompt, userMessage, options)
  
  // Extraire le JSON de la réponse (parfois entouré de ```json)
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/{[\s\S]*}/)
  
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }
  
  return JSON.parse(jsonMatch[0].replace(/```json\n?|\n?```/g, ''))
}

export default openai

