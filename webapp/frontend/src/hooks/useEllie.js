import { useState } from 'react'

const ELLIE_SYSTEM = `You are ELLIE — Executive Life Logic Intelligence Engine.
You are the personal AI built exclusively for Drew.
You are crisp, confident, analytical, and occasionally wry.
You never pad your responses.
Use bold text (**label**) for sector/category labels.
Keep responses under 400 words.
Sign off with "— ELLIE" at the end.`

export function useEllie() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  const getBrief = async (prompt) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: ELLIE_SYSTEM,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await res.json()
      const text = data.content?.map(b => b.text || '').join('') || ''
      setResponse(text)
      return text
    } catch (err) {
      setError('ELLIE feed interrupted.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { getBrief, loading, response, error }
}
