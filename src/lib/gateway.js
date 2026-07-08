const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  'https://gateway-production-a488.up.railway.app'

export async function checkGatewayHealth() {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: data.status === 'ok', data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export async function queryKnowledgeBase(question) {
  const res = await fetch(`${GATEWAY_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: question,
      mode: 'OPERATORE_INTERNO',
    }),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Errore gateway (${res.status})`)
  }

  return data
}
