import { useState, useEffect, useRef } from 'react'
import { generateImage, generateProp } from '../services/pixellab'

const TTL = 7 * 24 * 60 * 60 * 1000

function storageKey(tag, width, height) {
  const str = `${width}x${height}::${tag}`
  try { return `pxl::${btoa(str).slice(0, 80)}` } catch { return `pxl::${str.slice(0, 80)}` }
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { url, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL) { localStorage.removeItem(key); return null }
    return url
  } catch { return null }
}

function writeCache(key, url) {
  try { localStorage.setItem(key, JSON.stringify({ url, ts: Date.now() })) } catch {}
}

function makeHook(fetcher) {
  return function useAsset(description, width, height, startDelay = 0) {
    const key = storageKey(description, width, height)
    const [src, setSrc] = useState(() => readCache(key))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const inFlight = useRef(false)
    const mounted = useRef(true)

    useEffect(() => {
      mounted.current = true
      return () => { mounted.current = false }
    }, [])

    useEffect(() => {
      if (src || inFlight.current) return
      inFlight.current = true

      let retryTimer = null

      function attempt(delay) {
        const timer = setTimeout(() => {
          if (!mounted.current) return
          setLoading(true)
          fetcher({ description, width, height })
            .then(base64 => {
              if (!base64 || !mounted.current) return
              const url = `data:image/png;base64,${base64}`
              writeCache(key, url)
              setSrc(url)
            })
            .catch(err => {
              if (!mounted.current) return
              // Retry once on rate limit (429) after 12 seconds
              if (err.message?.includes('429') && !retryTimer) {
                setLoading(true)
                retryTimer = setTimeout(() => attempt(0), 12000)
              } else {
                setError(err.message)
              }
            })
            .finally(() => {
              if (!mounted.current) return
              setLoading(false)
              if (!retryTimer) inFlight.current = false
            })
        }, delay)
        return timer
      }

      const firstTimer = attempt(startDelay)

      return () => {
        clearTimeout(firstTimer)
        if (retryTimer) clearTimeout(retryTimer)
        inFlight.current = false
      }
    }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

    return { src, loading, error }
  }
}

// Transparent pixel art character / overlay sprite
export const usePixellabSprite = makeHook(
  ({ description, width, height }) => generateImage({ description, width, height, noBackground: true })
)

// Solid-background pixel art scene (room background)
export const usePixellabScene = makeHook(
  ({ description, width, height }) => generateImage({ description, width, height, noBackground: false })
)

// Isometric game prop via /map-objects (desk, chair, equipment)
export const usePixellabProp = makeHook(generateProp)
