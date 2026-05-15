/**
 * govee.js — ELLIE IoT light layer
 *
 * Watches the Zustand ellieAvatarState and police dispatch events,
 * then fires the matching Govee scene via the backend API.
 *
 * Scene mapping:
 *   ELLIE state → Govee scene
 *   ────────────────────────────────────────────
 *   idle        → idle          (deep blue, dim)
 *   thinking    → thinking      (blue-white, breathe)
 *   speaking    → speaking      (cyan pulse, medium)
 *   listening   → listening     (soft blue, dim)
 *   alert       → alert         (red steady, bright)
 *
 *   Police widget dispatches:
 *   PRIORITY incident → police_alert  (red pulse, full brightness)
 *   Any new incident  → threat_spike  (amber, medium) — debounced to 5 s
 *
 * Usage:
 *   import { useGoveeSync } from '../lib/govee'
 *   // call once inside a top-level component
 *   useGoveeSync()
 */

import { useEffect, useRef } from 'react'
import { useEllieStore } from '../store'
import { iotApi } from './api'

// Minimum ms between scene changes (avoid spamming Govee rate limiter)
const SCENE_DEBOUNCE_MS = 1200

export function useGoveeSync(enabled = true) {
  const avatarState    = useEllieStore(s => s.ellieAvatarState)
  const lastStateRef   = useRef(null)
  const lastFiredRef   = useRef(0)
  const pendingRef     = useRef(null)

  useEffect(() => {
    if (!enabled) return
    if (avatarState === lastStateRef.current) return

    lastStateRef.current = avatarState

    const now = Date.now()
    const sinceLastFire = now - lastFiredRef.current

    const fire = () => {
      lastFiredRef.current = Date.now()
      iotApi.triggerScene(avatarState).catch(() => {
        // Silently ignore — IoT is best-effort, never break the UI
      })
    }

    if (sinceLastFire >= SCENE_DEBOUNCE_MS) {
      fire()
    } else {
      // Schedule a delayed fire so the final state wins
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(fire, SCENE_DEBOUNCE_MS - sinceLastFire)
    }

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
    }
  }, [avatarState, enabled])
}

/**
 * Fire a specific Govee scene programmatically (outside of React lifecycle).
 * Used by PoliceWidget for priority incident flashes.
 */
export function fireGoveeScene(sceneName) {
  iotApi.triggerScene(sceneName).catch(() => {})
}
