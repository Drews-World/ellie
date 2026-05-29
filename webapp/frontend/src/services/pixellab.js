const BASE = 'https://api.pixellab.ai/v2'
const key = () => import.meta.env.VITE_PIXELLAB_API_KEY

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Pixellab ${res.status}: ${text}`)
  }
  return res.json()
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key()}` },
  })
  if (!res.ok) throw new Error(`Pixellab ${res.status}`)
  return res.json()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export async function pollJob(jobId, { interval = 5000, maxAttempts = 36 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval)
    const data = await get(`/background-jobs/${jobId}`)
    if (data.status === 'completed') return data.last_response
    if (data.status === 'failed') throw new Error(`Job ${jobId} failed`)
  }
  throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`)
}

// Generate a pixel art image. noBackground=true → transparent, false → solid scene.
// Returns a base64-encoded PNG string.
export async function generateImage({ description, width = 64, height = 64, noBackground = true }) {
  const data = await post('/create-image-pixflux', {
    description,
    image_size: { width, height },
    no_background: noBackground,
  })
  return data.image.base64
}

// Alias kept for backward compat.
export async function generateSprite({ description, width = 64, height = 64 }) {
  return generateImage({ description, width, height, noBackground: true })
}

// Generate a map object prop (isometric furniture/prop).
// Tries the /map-objects endpoint first; falls back to pixflux if it returns a job.
export async function generateProp({ description, width = 96, height = 64 }) {
  try {
    const data = await post('/map-objects', {
      description,
      image_size: { width, height },
    })
    if (data.image?.base64) return data.image.base64
    if (data.background_job_id) {
      const result = await pollJob(data.background_job_id)
      return result?.image?.base64 ?? null
    }
  } catch {
    // map-objects failed — fall back to pixflux with transparent bg
  }
  return generateImage({ description, width, height, noBackground: true })
}

export async function getBalance() {
  return get('/balance')
}
