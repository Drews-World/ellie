import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../lib/api'
import { BUSINESS_CREW } from './crews'

// Pipeline step → which agent is the active worker (mirrors the old factory).
const FORGE_STEPS = new Set(['starting', 'designing', 'imaging', 'concepts', 'scoring', 'saving'])

const NAME_TO_ID = Object.fromEntries(
  BUSINESS_CREW.agents.flatMap(a => [[a.name.toLowerCase(), a.id], [a.id, a.id]])
)

function normalizeEvents(raw) {
  const arr = Array.isArray(raw) ? raw
    : Array.isArray(raw?.items) ? raw.items
    : Array.isArray(raw?.activity) ? raw.activity
    : Array.isArray(raw?.actions) ? raw.actions
    : []
  return arr.map((e, i) => {
    const agentRaw = e.agent || e.agent_name || ''
    return {
      id: e.id ?? e.run_id ?? i,
      agent: agentRaw,
      agentId: NAME_TO_ID[agentRaw.toLowerCase?.()] ?? null,
      message: e.summary || e.message || e.detail || e.text || '',
      ts: e.ts || e.timestamp || e.occurred_at || e.created_at || '',
    }
  })
}

// Derive each agent's status from the live pipeline + recent activity.
export function deriveBusinessStatus(pipeline, events) {
  const status = {}
  for (const a of BUSINESS_CREW.agents) status[a.id] = 'idle'

  let activeId = null
  const running = !!pipeline?.running
  if (running) {
    status.ellie = 'working'
    const step = pipeline.step
    if (step === 'researching') activeId = 'nova'
    else if (FORGE_STEPS.has(step)) activeId = 'forge'
    else if (step === 'notifying') activeId = 'archives'
    if (activeId) status[activeId] = 'working'
    if (pipeline.step === 'error') { status.ellie = 'error' }
  }

  // Recently-active agents from the feed: most recent → "talking", older → "done".
  events.slice(0, 6).forEach((e, i) => {
    if (!e.agentId || status[e.agentId] === 'working') return
    status[e.agentId] = i === 0 && running ? 'talking' : 'done'
  })

  return { statusByAgent: status, activeId }
}

export function useBusinessCrew(pollMs = 3500) {
  const [state, setState] = useState({
    statusByAgent: {}, activeId: null, events: [],
    pipeline: null, metrics: [], paused: false, headline: '', loading: true, offline: false,
  })
  const timer = useRef(null)

  const tick = useCallback(async () => {
    try {
      const [statusRes, pipeRes, actRes] = await Promise.all([
        api.get('/business/status').catch(() => null),
        api.get('/business/ellie/pipeline').catch(() => null),
        api.get('/business/activity', { params: { limit: 40 } }).catch(() => null),
      ])
      const pipeline = pipeRes?.data ?? null
      const events = normalizeEvents(actRes?.data)
      const { statusByAgent, activeId } = deriveBusinessStatus(pipeline, events)
      setState({
        statusByAgent, activeId, events, pipeline,
        metrics: statusRes?.data?.metrics ?? [],
        paused: !!statusRes?.data?.paused,
        headline: statusRes?.data?.headline ?? '',
        loading: false,
        offline: !statusRes && !pipeRes && !actRes,
      })
    } catch {
      setState(s => ({ ...s, loading: false, offline: true }))
    }
  }, [])

  useEffect(() => {
    tick()
    timer.current = setInterval(tick, pollMs)
    return () => clearInterval(timer.current)
  }, [tick, pollMs])

  return { ...state, refresh: tick }
}
