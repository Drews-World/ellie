import { useState, useEffect, useRef, useCallback } from 'react'
import RoomShell from '../components/shared/RoomShell'
import StatusPill from '../components/shared/StatusPill'
import api from '../lib/api'

// ── Shared room card wrapper ──────────────────────────────────────────────────
function Room({ icon, name, accent, status, action, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--paper-50)',
      border: '1.5px solid var(--ink-300)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {/* Room header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--paper-200)',
        background: 'var(--paper-100)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>{name}</span>
        <StatusPill status={status ?? 'offline'} label={status ?? 'offline'} />
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {/* Room body */}
      <div style={{ flex: 1, padding: 16, overflowY: 'auto', minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}

function Btn({ onClick, disabled, color = 'var(--violet-500)', children, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1.5px solid ${color}`,
      borderRadius: 'var(--radius-sm)',
      color,
      fontFamily: 'var(--font-ui)',
      fontWeight: 700,
      fontSize: small ? 11 : 12,
      padding: small ? '3px 10px' : '6px 14px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      whiteSpace: 'nowrap',
      transition: 'opacity var(--transition)',
    }}>{children}</button>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', fontStyle: 'italic' }}>{children}</p>
}

// ── Pipeline stages bar ───────────────────────────────────────────────────────
const PIPELINE_STAGES = ['Nova', 'Forge', 'Review', 'Publish']
const FORGE_STEPS = new Set(['designing', 'imaging', 'concepts', 'scoring', 'saving'])

function stageFromPipeline(pipeline, queue, publishProgress) {
  if (publishProgress?.running) return 3
  if (!pipeline) return queue.length > 0 ? 2 : -1
  if (!pipeline.running && pipeline.step !== 'done' && pipeline.step !== 'error') return queue.length > 0 ? 2 : -1
  const s = pipeline.step
  if (s === 'researching') return 0
  if (FORGE_STEPS.has(s) || s === 'starting') return 1
  if (s === 'done' || s === 'notifying') return queue.length > 0 ? 2 : 3
  return -1
}

function PipelineBar({ pipeline, queue, publishProgress }) {
  const active = stageFromPipeline(pipeline, queue, publishProgress)
  const isRunning = pipeline?.running || publishProgress?.running
  const hasError = pipeline?.step === 'error'
  const pct = pipeline?.pct ?? 0

  // Colors: completed = mint, active+running = violet, active+done = mint, future = dim, error = coral
  const stageColor = (i) => {
    if (hasError && i === active) return 'var(--coral-500)'
    if (i < active) return 'var(--mint-500)'
    if (i === active && isRunning) return 'var(--violet-500)'
    if (i === active && !isRunning && active >= 0) return 'var(--mint-500)'
    return 'var(--ink-300)'
  }

  const stageBg = (i) => {
    if (hasError && i === active) return 'rgba(255,82,82,0.10)'
    if (i < active) return 'rgba(34,211,164,0.08)'
    if (i === active && isRunning) return 'rgba(122,110,142,0.14)'
    if (i === active && !isRunning && active >= 0) return 'rgba(34,211,164,0.10)'
    return 'transparent'
  }

  const lineColor = (i) => i < active ? 'var(--mint-500)' : 'var(--paper-300)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '7px 16px', background: 'var(--paper-100)',
      borderBottom: '1px solid var(--paper-200)', flexShrink: 0, gap: 0,
    }}>
      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: i < PIPELINE_STAGES.length - 1 ? 1 : 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 99,
            background: stageBg(i),
            border: `1px solid ${(i === active) ? stageColor(i) : 'transparent'}`,
            transition: 'all 0.25s ease',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: 99, flexShrink: 0,
              background: stageColor(i),
              boxShadow: i === active && isRunning ? `0 0 7px ${stageColor(i)}` : 'none',
              transition: 'background 0.25s, box-shadow 0.25s',
            }} />
            <span style={{
              fontSize: 10, fontWeight: i === active ? 800 : 600,
              color: stageColor(i), textTransform: 'uppercase', letterSpacing: '0.07em',
              transition: 'color 0.25s',
            }}>{stage}</span>
            {i === active && isRunning && (
              <span style={{ fontSize: 9, color: 'var(--violet-500)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
            )}
          </div>
          {i < PIPELINE_STAGES.length - 1 && (
            <div style={{
              flex: 1, height: 1,
              background: lineColor(i), margin: '0 3px',
              transition: 'background 0.3s',
            }} />
          )}
        </div>
      ))}
      {/* Status label on the right */}
      <div style={{ marginLeft: 12, fontSize: 10, color: 'var(--ink-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
        {hasError
          ? <span style={{ color: 'var(--coral-500)' }}>✕ {pipeline.detail}</span>
          : isRunning
            ? <span style={{ color: 'var(--violet-500)' }}>⚙ {pipeline?.detail || publishProgress?.design_name || 'Running…'}</span>
            : active >= 0
              ? <span style={{ color: 'var(--mint-500)' }}>✓ {PIPELINE_STAGES[active]} complete{active === 2 && queue.length > 0 ? ` — ${queue.length} to review` : ''}</span>
              : <span style={{ color: 'var(--ink-300)' }}>Ready — give ELLIE a command to start</span>
        }
      </div>
    </div>
  )
}

// ── ELLIE supervisor room ─────────────────────────────────────────────────────
function StrategyReport({ report, onRunProposal, onDismiss }) {
  const scoreColor = s => s >= 0.8 ? 'var(--mint-500)' : s >= 0.6 ? 'var(--gold-500, #f59e0b)' : 'var(--ink-400)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--mint-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Strategy Report
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>
            {report.niches_analyzed > 0
              ? `Based on ${report.niches_analyzed} Nova trend reports`
              : 'No Nova research data available — run Nova first for better analysis'}
          </div>
        </div>
        <Btn onClick={onDismiss} color="var(--ink-400)" small>✕</Btn>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.5 }}>{report.summary}</div>

      {report.top_niches?.length > 0 && (
        <div>
          <Label>Top Niches</Label>
          {report.top_niches.map((n, i) => (
            <div key={i} style={{ background: 'var(--paper-100)', borderRadius: 'var(--radius-sm)',
              padding: '8px 10px', marginBottom: 5, borderLeft: `3px solid ${scoreColor(n.opportunity_score)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)' }}>{n.niche}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(n.opportunity_score) }}>
                  {Math.round((n.opportunity_score || 0) * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 5, lineHeight: 1.4 }}>{n.reasoning}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {n.best_products?.map(p => (
                  <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                    background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p}
                  </span>
                ))}
                {n.recommended_action && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, marginLeft: 'auto',
                    background: n.recommended_action === 'run Forge' ? 'rgba(94,234,212,0.15)' : 'rgba(0,0,0,0.05)',
                    color: n.recommended_action === 'run Forge' ? 'var(--mint-500)' : 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {n.recommended_action}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {report.catalog_gaps?.length > 0 && (
        <div>
          <Label>Catalog Gaps</Label>
          {report.catalog_gaps.map((g, i) => (
            <div key={i} style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '7px 10px', marginBottom: 5 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 2 }}>
                ⚠ {g.product_type}
                <span style={{ marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 99,
                  background: g.estimated_opportunity === 'high' ? 'rgba(251,191,36,0.2)' : 'rgba(0,0,0,0.06)',
                  color: g.estimated_opportunity === 'high' ? '#b45309' : 'var(--ink-400)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {g.estimated_opportunity}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-500)', lineHeight: 1.4 }}>{g.why_it_matters}</div>
              {g.blueprint_note && (
                <div style={{ fontSize: 9, color: 'var(--ink-400)', marginTop: 3, fontStyle: 'italic' }}>{g.blueprint_note}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {report.proposed_runs?.length > 0 && (
        <div>
          <Label>Proposed Forge Runs</Label>
          {report.proposed_runs.map((r, i) => (
            <div key={i} style={{ background: 'rgba(122,110,142,0.06)', border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)', marginBottom: 2 }}>{r.niche}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 4 }}>{r.rationale}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.products?.map(p => (
                      <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <Btn onClick={() => onRunProposal(r)} color="var(--violet-500)" small>Run</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExploreReport({ discovery, onDesign, onDismiss }) {
  const opps = discovery?.opportunities || []
  const scoreColor = s => s >= 0.7 ? 'var(--mint-500)' : s >= 0.4 ? 'var(--amber-500)' : 'var(--ink-400)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Trend Discovery
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>
            {opps.length > 0
              ? `${opps.length} fresh niches from live Etsy research — top opportunities first`
              : (discovery?.error || 'No opportunities found')}
          </div>
        </div>
        <Btn onClick={onDismiss} color="var(--ink-400)" small>✕</Btn>
      </div>

      {opps.map((opp, i) => (
        <div key={i} style={{
          background: 'var(--paper-100)',
          border: `1.5px solid ${i === 0 ? 'var(--amber-500)' : 'var(--paper-300)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-900)' }}>
              {i === 0 && <span style={{ color: 'var(--amber-500)', marginRight: 5 }}>★</span>}
              {opp.niche}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(opp.opportunity_score), fontFamily: 'var(--font-mono)' }}>
              {Math.round((opp.opportunity_score || 0) * 100)}%
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4 }}>{opp.opportunity}</div>

          {opp.price_range?.sweet_spot && (
            <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>
              Sweet spot: <strong style={{ color: 'var(--ink-700)' }}>${opp.price_range.sweet_spot}</strong>
              {opp.price_range.low && opp.price_range.high && ` (range $${opp.price_range.low}–$${opp.price_range.high})`}
            </div>
          )}

          {opp.concepts?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {opp.concepts.map((c, j) => (
                <div key={j} style={{ fontSize: 10, color: 'var(--ink-600)', display: 'flex', gap: 5 }}>
                  <span style={{ color: 'var(--amber-500)' }}>·</span>{c}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
            {opp.recommended_products?.map(p => (
              <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {p}
              </span>
            ))}
            {opp.top_tags?.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(0,0,0,0.05)', color: 'var(--ink-400)', textTransform: 'lowercase' }}>
                #{t}
              </span>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <Btn onClick={() => onDesign(opp)} color="var(--violet-500)" small>→ Design This</Btn>
            </div>
          </div>

          {opp.avoid && (
            <div style={{ fontSize: 9, color: 'var(--coral-500)', fontStyle: 'italic', lineHeight: 1.4 }}>
              Avoid: {opp.avoid}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function EllieRoom({ status, activity, onRefresh, onStatusUpdate, onRunNova, onRunForge, onPublishAll }) {
  const agentStatus = status?.agents?.find(a => a.name === 'ELLIE')?.status ?? 'idle'
  const spend = status?.metrics?.find(m => m.label === 'Spend today')?.value ?? '—'

  const [cmd, setCmd] = useState('')
  const [thinking, setThinking] = useState(false)
  const [plan, setPlan] = useState(null)
  const [strategyReport, setStrategyReport] = useState(null)
  const [exploreReport, setExploreReport] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [pipeline, setPipeline] = useState(null)
  const pollRef = useRef(null)

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const startPipelinePoll = () => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/business/ellie/pipeline')
        const p = res.data
        setPipeline(p)
        onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, pipeline: p })
        if (!p.running) {
          stopPoll()
          if (p.step === 'done') onRefresh()
        }
      } catch { stopPoll() }
    }, 2000)
  }

  useEffect(() => () => stopPoll(), [])

  const sendCommand = async () => {
    if (!cmd.trim()) return
    setThinking(true)
    setPlan(null)
    setStrategyReport(null)
    setExploreReport(null)
    onStatusUpdate?.({ thinking: true, plan: null, strategyReport: null, exploreReport: null, pipeline: null })
    try {
      const res = await api.post('/business/ellie/command', { message: cmd })
      const data = res.data
      if (data.command_type === 'strategy') {
        setStrategyReport(data.report)
        onStatusUpdate?.({ thinking: false, plan: null, strategyReport: data.report, exploreReport: null, pipeline: null })
      } else if (data.command_type === 'explore') {
        setExploreReport(data.discovery)
        onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, exploreReport: data.discovery, pipeline: null })
      } else {
        // both 'design' and 'repurpose' return a plan object
        setPlan(data.plan)
        onStatusUpdate?.({ thinking: false, plan: data.plan, strategyReport: null, exploreReport: null, pipeline: null })
      }
    } catch (e) {
      setPlan({ error: 'Failed to reach ELLIE' })
      onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, exploreReport: null, pipeline: null })
    }
    setThinking(false)
  }

  const confirmPlan = async (planToRun) => {
    const p = planToRun || plan
    setConfirming(true)
    try {
      await api.post('/business/ellie/confirm', { plan: p })
      const pipelineState = { running: true, step: 'starting', detail: 'ELLIE is spinning up the pipeline…', pct: 0 }
      setPipeline(pipelineState)
      onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, exploreReport: null, pipeline: pipelineState })
      startPipelinePoll()
      setPlan(null)
      setStrategyReport(null)
      setExploreReport(null)
      setCmd('')
    } catch { }
    setConfirming(false)
  }

  const runProposal = (proposal) => {
    // Convert a proposed_run from the strategy report into a pipeline plan
    const syntheticPlan = {
      command_type: 'design',
      understood_intent: `Run Forge for: ${proposal.niche}`,
      interpretation: proposal.rationale,
      niches: [{
        name: proposal.niche,
        description: proposal.niche,
        suggested_products: proposal.products,
        n_concepts: proposal.n_concepts || 3,
        style_notes: '',
      }],
      market_reasoning: proposal.rationale,
    }
    confirmPlan(syntheticPlan)
  }

  const pipelineActive = pipeline && (pipeline.running || pipeline.step === 'done' || pipeline.step === 'error')

  return (
    <Room icon="🧠" name="ELLIE" accent="var(--violet-500)" status={thinking || pipeline?.running ? 'online' : agentStatus}
      style={{ gridArea: 'ellie' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

        {/* Spend */}
        <div style={{ fontSize: 11, color: 'var(--ink-500)', textAlign: 'center' }}>
          Spend today: <strong style={{ color: 'var(--ink-800)' }}>{spend}</strong>
        </div>

        {/* Pipeline progress */}
        {pipelineActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: pipeline.step === 'error' ? 'var(--coral-500)' : pipeline.step === 'done' ? 'var(--mint-500)' : 'var(--violet-500)' }}>
                {pipeline.step === 'done' ? '✓ Done' : pipeline.step === 'error' ? '✕ Error' : `⚙ ${pipeline.step}`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{pipeline.pct}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--paper-200)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pipeline.pct}%`, borderRadius: 99, transition: 'width 0.4s ease',
                background: pipeline.step === 'error' ? 'var(--coral-500)' : pipeline.step === 'done' ? 'var(--mint-500)' : 'var(--violet-500)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4 }}>{pipeline.detail}</div>
          </div>
        )}

        {/* Strategy report */}
        {strategyReport && (
          <StrategyReport
            report={strategyReport}
            onRunProposal={runProposal}
            onDismiss={() => setStrategyReport(null)}
          />
        )}

        {/* Explore / trend discovery report */}
        {exploreReport && (
          <ExploreReport
            discovery={exploreReport}
            onDesign={(opp) => {
              const syntheticPlan = {
                command_type: 'design',
                understood_intent: `Design for: ${opp.niche}`,
                interpretation: opp.opportunity,
                niches: [{
                  name: opp.niche,
                  description: opp.opportunity || opp.niche,
                  suggested_products: opp.recommended_products?.length ? opp.recommended_products : ['t-shirt', 'mug', 'tote bag'],
                  n_concepts: 3,
                  style_notes: opp.style_themes?.join(', ') || '',
                }],
                market_reasoning: opp.opportunity,
              }
              setExploreReport(null)
              setPlan(syntheticPlan)
            }}
            onDismiss={() => setExploreReport(null)}
          />
        )}

        {/* Plan confirmation card */}
        {plan && !plan.error && (
          <div style={{ background: 'rgba(122,110,142,0.07)', border: '1.5px solid var(--violet-500)',
            borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {plan.command_type === 'repurpose' ? '♻ Repurpose Plan' : "ELLIE's Plan"}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-800)', fontWeight: 600, lineHeight: 1.4 }}>
              {plan.understood_intent}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.5 }}>
              {plan.interpretation}
            </div>

            {/* Repurpose: show target products + design list */}
            {plan.command_type === 'repurpose' && plan.new_products?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  New Products
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {plan.new_products.map(p => (
                    <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: 'rgba(94,234,212,0.12)', color: 'var(--mint-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {plan.command_type === 'repurpose' && plan.designs?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  Designs to Repurpose ({plan.designs.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {plan.designs.slice(0, 6).map((d, i) => (
                    <div key={i} style={{ fontSize: 10, color: 'var(--ink-700)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--ink-400)' }}>·</span>
                      <span style={{ fontWeight: 600 }}>{d.concept_name || d.name}</span>
                      <span style={{ color: 'var(--ink-400)' }}>{d.niche}</span>
                    </div>
                  ))}
                  {plan.designs.length > 6 && (
                    <div style={{ fontSize: 10, color: 'var(--ink-400)', fontStyle: 'italic' }}>
                      …and {plan.designs.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Design plan: niche breakdown */}
            {plan.command_type !== 'repurpose' && plan.niches?.map((n, i) => (
              <div key={i} style={{ background: 'var(--paper-100)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)', marginBottom: 3 }}>{n.name}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 4 }}>{n.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {n.suggested_products?.map(p => (
                    <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {plan.market_reasoning && (
              <div style={{ fontSize: 10, color: 'var(--ink-400)', fontStyle: 'italic', lineHeight: 1.4 }}>
                {plan.market_reasoning}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn onClick={() => confirmPlan()} disabled={confirming || (plan.command_type === 'repurpose' && !plan.designs?.length)} color="var(--violet-500)">
                {confirming ? '⏳ Starting…' : plan.command_type === 'repurpose' ? '♻ Repurpose' : '✓ Run it'}
              </Btn>
              <Btn onClick={() => setPlan(null)} color="var(--ink-400)">✕ Cancel</Btn>
            </div>
          </div>
        )}
        {plan?.error && (
          <div style={{ fontSize: 11, color: 'var(--coral-500)' }}>{plan.error}</div>
        )}

        {/* Manual controls */}
        <div style={{ borderTop: '1px solid var(--paper-200)', paddingTop: 10, marginTop: 'auto' }}>
          <Label>Manual Controls</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn onClick={onRunNova} disabled={pipeline?.running} color="var(--mint-500)" small>▶ Run Nova</Btn>
            <Btn onClick={onRunForge} disabled={pipeline?.running} color="var(--amber-500)" small>▶ Run Forge</Btn>
            <Btn onClick={onPublishAll} disabled={pipeline?.running} color="var(--violet-500)" small>✓ Publish All</Btn>
          </div>
        </div>

        {/* Command input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Tell ELLIE what to do</Label>
          <textarea
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand() } }}
            placeholder="e.g. make hiking designs for mugs… or: what's trending right now? or: reuse my designs as canvases"
            rows={2}
            disabled={thinking || pipeline?.running}
            style={{ width: '100%', resize: 'none', padding: '8px 10px',
              border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)',
              background: 'var(--paper-100)', color: 'var(--ink-900)',
              fontFamily: 'var(--font-ui)', fontSize: 12 }}
          />
          <Btn onClick={sendCommand} disabled={thinking || !cmd.trim() || pipeline?.running} color="var(--violet-500)">
            {thinking ? '⏳ Thinking…' : '→ Send'}
          </Btn>
        </div>
      </div>
    </Room>
  )
}

// ── FORGE design room ─────────────────────────────────────────────────────────
const FORGE_PRESETS = [
  { label: 'Etsy Profile',  prompt: 'Etsy shop profile picture — minimalist mountain adventure logo, square, bold clean lines', n: 3 },
  { label: 'Shop Banner',   prompt: 'Etsy shop banner — wide minimalist mountain landscape, sunrise gradient, atmospheric', n: 3 },
  { label: 'Mug Design',    prompt: 'minimalist mountain coffee mug print design, clean typography, earthy tones', n: 5 },
  { label: 'Tee Design',    prompt: 'vintage adventure t-shirt graphic, mountain silhouette, retro sun badge', n: 5 },
  { label: 'Logo Concept',  prompt: 'minimal outdoor brand logo concept, mountain peak, simple geometric', n: 3 },
]

function ForgeRoom({ queue, onRun, onVerdict, onRefresh, paused }) {
  const [niche, setNiche] = useState('')
  const [nConcepts, setNConcepts] = useState(5)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const pollRef = useRef(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = () => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/business/forge/progress')
        const p = res.data
        setProgress(p)
        if (!p.running) {
          stopPolling()
          setRunning(false)
          if (p.step === 'done') onRefresh()
        }
      } catch { stopPolling(); setRunning(false) }
    }, 1500)
  }

  useEffect(() => () => stopPolling(), [])

  const agentStatus = running ? 'online' : queue.length > 0 ? 'online' : 'idle'

  const handleRun = async () => {
    if (!niche.trim()) return
    setRunning(true)
    setProgress({ running: true, step: 'starting', detail: 'Kicking off Forge…', pct: 0 })
    await onRun(niche.trim(), nConcepts)
    startPolling()
  }

  const applyPreset = (p) => {
    setNiche(p.prompt)
    setNConcepts(p.n)
  }

  return (
    <Room icon="🔨" name="Forge · Design Room" accent="var(--amber-500)" status={running ? 'online' : agentStatus}
      style={{ gridArea: 'forge' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Etsy branding presets */}
        <div>
          <Label>Quick Presets</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FORGE_PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} style={{
                background: niche === p.prompt ? 'rgba(255,178,63,0.2)' : 'var(--paper-100)',
                border: `1px solid ${niche === p.prompt ? 'var(--amber-500)' : 'var(--ink-300)'}`,
                borderRadius: 'var(--radius-sm)',
                color: niche === p.prompt ? 'var(--amber-500)' : 'var(--ink-600)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: 11,
                padding: '5px 11px',
                cursor: 'pointer',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Trigger controls */}
        <div>
          <Label>Custom Prompt</Label>
          <textarea
            value={niche}
            onChange={e => setNiche(e.target.value)}
            placeholder="describe what to design..."
            rows={2}
            style={{
              width: '100%', resize: 'none', padding: '8px 10px',
              border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)',
              background: 'var(--paper-100)', color: 'var(--ink-900)',
              fontFamily: 'var(--font-ui)', fontSize: 12, marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 3, 5].map(n => (
                <button key={n} onClick={() => setNConcepts(n)} style={{
                  background: nConcepts === n ? 'rgba(255,178,63,0.2)' : 'var(--paper-100)',
                  border: `1px solid ${nConcepts === n ? 'var(--amber-500)' : 'var(--ink-300)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: nConcepts === n ? 'var(--amber-500)' : 'var(--ink-500)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700, fontSize: 12,
                  padding: '5px 10px', cursor: 'pointer',
                }}>{n}</button>
              ))}
              <span style={{ fontSize: 11, color: 'var(--ink-400)', alignSelf: 'center', marginLeft: 4 }}>concepts</span>
            </div>
            <Btn onClick={handleRun} disabled={running || paused || !niche.trim()} color="var(--amber-500)">
              {running ? '⏳ Running…' : '▶ Run Forge'}
            </Btn>
          </div>
        </div>

        {/* Progress bar */}
        {progress && (progress.running || progress.step === 'done' || progress.step === 'error') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: progress.step === 'error' ? 'var(--coral-500)' : 'var(--amber-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {progress.step === 'done' ? '✓ Done' : progress.step === 'error' ? '✕ Error' : `⚙ ${progress.step}`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{progress.pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--paper-200)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress.pct}%`,
                background: progress.step === 'error' ? 'var(--coral-500)' : progress.step === 'done' ? 'var(--mint-500)' : 'var(--amber-500)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4 }}>{progress.detail}</div>
          </div>
        )}

        {/* Design queue */}
        <div>
          <Label>Design Queue {queue.length > 0 ? `(${queue.length})` : ''}</Label>
          {queue.length === 0
            ? <Empty>No designs in queue — run Forge to generate</Empty>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {queue.slice(0, 12).map(d => (
                  <div key={d.id} style={{
                    background: 'var(--paper-100)', border: '1px solid var(--paper-200)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  }}>
                    {d.image_url
                      ? <img src={d.image_url} alt={d.concept_name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                      : (
                        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎨</div>
                      )
                    }
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 4, lineHeight: 1.3 }}>{d.concept_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-400)', marginBottom: 6 }}>score {((d.forge_score ?? 0) * 100).toFixed(0)}%</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onVerdict(d.id, 'approve')} title="Approve" style={tinyBtn('var(--mint-500)')}>✓</button>
                        <button onClick={() => onVerdict(d.id, 'iterate')} title="Iterate" style={tinyBtn('var(--amber-500)')}>↻</button>
                        <button onClick={() => onVerdict(d.id, 'reject')} title="Reject" style={tinyBtn('var(--coral-500)')}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </Room>
  )
}

function tinyBtn(color) {
  return {
    flex: 1, padding: '3px 0', background: 'transparent',
    border: `1px solid ${color}`, borderRadius: 6,
    color, fontWeight: 700, fontSize: 11, cursor: 'pointer',
  }
}

// ── NOVA research room ────────────────────────────────────────────────────────
function NovaRoom({ trends, onRun }) {
  const [running, setRunning] = useState(false)
  const recent = trends?.trends?.slice(0, 5) ?? []

  const handleRun = async () => {
    setRunning(true)
    await onRun()
    setTimeout(() => setRunning(false), 3000)
  }

  return (
    <Room icon="🔭" name="Nova · Research" accent="var(--mint-500)"
      status={running ? 'online' : recent.length > 0 ? 'online' : 'idle'}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Btn onClick={handleRun} disabled={running} color="var(--mint-500)">
          {running ? '⏳ Researching…' : '▶ Run Nova'}
        </Btn>
        {recent.length === 0
          ? <Empty>No trend reports yet — click Run to research niches</Empty>
          : recent.map((t, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: 'var(--paper-100)',
              border: '1px solid var(--paper-200)', borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-900)', marginBottom: 3,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.niche}</div>
              {t.opportunity && (
                <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{t.opportunity}</div>
              )}
              {t.avg_price_usd && (
                <div style={{ fontSize: 10, color: 'var(--mint-600, var(--mint-500))', marginTop: 4, fontWeight: 700 }}>
                  avg ${Number(t.avg_price_usd).toFixed(2)} · {t.signal_count ?? 0} signals
                </div>
              )}
            </div>
          ))
        }
      </div>
    </Room>
  )
}

// ── ARCHIVES review room ──────────────────────────────────────────────────────
function RunHistoryItem({ run, onRerun, onExpand, expanded }) {
  const statusColor = run.status === 'done' ? 'var(--mint-500)' : run.status === 'error' ? 'var(--coral-500)' : run.status === 'running' ? 'var(--violet-500)' : 'var(--ink-400)'
  const started = run.started_at ? new Date(run.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  return (
    <div style={{ border: '1px solid var(--paper-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 8 }}>
      <div
        onClick={onExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--paper-100)', cursor: 'pointer' }}>
        <div style={{ width: 6, height: 6, borderRadius: 99, background: statusColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {run.command || run.niche || 'Pipeline run'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink-500)', marginTop: 1 }}>
            {started} · {run.designs_created ?? 0} design(s) · <span style={{ color: statusColor }}>{run.status}</span>
          </div>
        </div>
        <Btn onClick={e => { e.stopPropagation(); onRerun(run.id) }} color="var(--violet-500)" small>↻ Re-run</Btn>
        <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--paper-200)' }}>
          <RunDetail runId={run.id} />
        </div>
      )}
    </div>
  )
}

function RunDetail({ runId }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get(`/business/ellie/pipeline/runs/${runId}`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail({ designs: [], activity: [] }))
      .finally(() => setLoading(false))
  }, [runId])
  if (loading) return <div style={{ fontSize: 10, color: 'var(--ink-400)', padding: '4px 0' }}>Loading…</div>
  const designs = detail?.designs ?? []
  const acts = detail?.activity ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {designs.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
            Designs ({designs.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {designs.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {d.image_url
                  ? <img src={d.image_url} alt={d.concept_name} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🎨</div>
                }
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink-700)' }}>{d.concept_name}</div>
                  <div style={{ fontSize: 8, color: 'var(--ink-400)' }}>{d.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {acts.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Activity</div>
          {acts.slice(0, 8).map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: 'var(--ink-600)', padding: '2px 0', borderBottom: '1px solid var(--paper-100)', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--ink-400)', marginRight: 4 }}>[{a.agent}]</span>{a.message}
            </div>
          ))}
        </div>
      )}
      {designs.length === 0 && acts.length === 0 && (
        <div style={{ fontSize: 10, color: 'var(--ink-400)', fontStyle: 'italic' }}>No data linked to this run yet</div>
      )}
    </div>
  )
}

function ArchivesRoom({ queue, onVerdict, runs, onRerun }) {
  const [tab, setTab] = useState('queue')
  const [expandedRun, setExpandedRun] = useState(null)
  const tabStyle = (t) => ({
    padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: 'none', background: 'none', fontFamily: 'var(--font-ui)',
    color: tab === t ? 'var(--rose-500)' : 'var(--ink-500)',
    borderBottom: tab === t ? '2px solid var(--rose-500)' : '2px solid transparent',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--paper-200)', marginBottom: 12, flexShrink: 0 }}>
        <button style={tabStyle('queue')} onClick={() => setTab('queue')}>
          Review Queue {queue.length > 0 && `(${queue.length})`}
        </button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>
          Run History {runs.length > 0 && `(${runs.length})`}
        </button>
      </div>

      {tab === 'queue' && (
        queue.length === 0
          ? <Empty>Queue clear — no designs awaiting review</Empty>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {queue.map(d => (
                <div key={d.id} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 12px', background: 'var(--paper-100)',
                  border: '1px solid var(--paper-200)', borderRadius: 'var(--radius-md)',
                }}>
                  {d.image_url
                    ? <img src={d.image_url} alt={d.concept_name} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎨</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-900)', marginBottom: 1 }}>{d.concept_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-600)', marginBottom: 6 }}>
                      {d.niche} · score {((d.forge_score ?? 0) * 100).toFixed(0)}%
                    </div>
                    {d.sell_reason && (
                      <div style={{ fontSize: 10, color: 'var(--ink-600)', marginBottom: 6, fontStyle: 'italic', lineHeight: 1.3 }}>{d.sell_reason}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn onClick={() => onVerdict(d.id, 'approve')} color="var(--mint-500)" small>✓ Approve</Btn>
                      <Btn onClick={() => onVerdict(d.id, 'iterate')} color="var(--amber-500)" small>↻ Iterate</Btn>
                      <Btn onClick={() => onVerdict(d.id, 'reject')} color="var(--coral-500)" small>✕ Reject</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {tab === 'history' && (
        runs.length === 0
          ? <Empty>No pipeline runs yet — give ELLIE a command to start</Empty>
          : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {runs.map(run => (
                <RunHistoryItem
                  key={run.id}
                  run={run}
                  onRerun={onRerun}
                  expanded={expandedRun === run.id}
                  onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                />
              ))}
            </div>
          )
      )}
    </div>
  )
}

// ── TREASURY cost room ────────────────────────────────────────────────────────
function TreasuryRoom({ spend }) {
  const total = spend?.today_usd ?? 0
  const byAgent = spend?.by_agent ?? {}
  const limit = 10
  const pct = Math.min((total / limit) * 100, 100)
  const barColor = pct > 80 ? 'var(--coral-500)' : pct > 50 ? 'var(--amber-500)' : 'var(--mint-500)'
  const agents = Object.entries(byAgent).sort((a, b) => b[1] - a[1])

  return (
    <Room icon="💰" name="Treasury" accent="var(--peach-500)" status="online" style={{ gridArea: 'treasury' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spend today */}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: barColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            ${Number(total).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>spent today of ${limit} limit</div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'var(--paper-200)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* By agent */}
        {agents.length > 0 && (
          <div>
            <Label>By Agent</Label>
            {agents.map(([agent, cost]) => (
              <div key={agent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--paper-200)', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{agent}</span>
                <span style={{ color: 'var(--peach-500)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  ${Number(cost).toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        )}
        {agents.length === 0 && <Empty>No spend recorded today</Empty>}
      </div>
    </Room>
  )
}

// ── Compact dashboard card ────────────────────────────────────────────────────
function CompactCard({ id, icon, name, status, accent = 'var(--violet-500)', badge, onExpand, children }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={() => onExpand(id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--paper-50)',
        border: `1.5px solid ${hov ? accent : 'var(--ink-300)'}`,
        borderRadius: 'var(--radius-lg)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: hov ? `0 0 0 3px color-mix(in srgb, ${accent} 15%, transparent)` : 'var(--shadow-sm)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        minHeight: 0,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid var(--paper-200)',
        background: 'var(--paper-100)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--ink-900)', flex: 1, letterSpacing: '-0.01em' }}>{name}</span>
        {badge}
        <StatusPill status={status ?? 'offline'} label={status ?? 'offline'} />
        <span style={{ fontSize: 10, color: accent, fontWeight: 700, opacity: hov ? 1 : 0.35, transition: 'opacity 0.12s' }}>↗</span>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

// ── Room expand modal ─────────────────────────────────────────────────────────
function RoomModal({ icon, title, onClose, wide, visible, children }) {
  useEffect(() => {
    if (!visible) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose, visible])
  return (
    <div
      style={{
        display: visible ? 'flex' : 'none',
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(10,8,15,0.55)',
        backdropFilter: 'blur(3px)',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--paper-50)',
        border: '1.5px solid var(--ink-300)',
        borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: wide ? 900 : 680, height: '84vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px',
          borderBottom: '1px solid var(--paper-200)',
          background: 'var(--paper-100)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-900)', flex: 1 }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: '1.5px solid var(--ink-300)',
            borderRadius: 'var(--radius-sm)', color: 'var(--ink-600)',
            cursor: 'pointer', padding: '4px 14px', fontSize: 12,
            fontFamily: 'var(--font-ui)', fontWeight: 700,
          }}>✕ <span style={{ fontSize: 10, opacity: 0.5 }}>Esc</span></button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Compact card summaries ────────────────────────────────────────────────────
function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--ink-800)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-600)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ height: 4, background: 'var(--paper-200)', borderRadius: 99, marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  )
}

function EllieSummary({ status, pipeline, roomStatus }) {
  const spend = status?.metrics?.find(m => m.label === 'Spend today')?.value ?? '$0.00'
  const activePipeline = roomStatus?.pipeline ?? pipeline
  const running = activePipeline?.running

  let statusLine = null
  if (roomStatus?.thinking) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--violet-500)', fontWeight: 700 }}>⏳ Thinking…</div>
  } else if (roomStatus?.strategyReport) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--mint-500)', fontWeight: 700 }}>📊 Strategy report ready — click to view</div>
  } else if (roomStatus?.exploreReport) {
    const n = roomStatus.exploreReport?.opportunities?.length || 0
    statusLine = <div style={{ fontSize: 11, color: 'var(--amber-500)', fontWeight: 700 }}>🔍 {n} trending niches found — click to explore</div>
  } else if (roomStatus?.plan && !roomStatus.plan.error) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--violet-500)', fontWeight: 700 }}>📋 Plan ready — click to review & run</div>
  } else if (!running) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--ink-500)', fontStyle: 'italic' }}>Click to give ELLIE a command</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-700)' }}>Spend today: <strong style={{ color: 'var(--ink-900)' }}>{spend}</strong></div>
      {running ? (
        <>
          <MiniBar pct={activePipeline.pct} color="var(--violet-500)" />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚙ {activePipeline.step} — {activePipeline.pct}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-600)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{activePipeline.detail}</div>
        </>
      ) : statusLine}
    </div>
  )
}

function ForgeSummary({ queue, progress }) {
  const running = progress?.running
  const color = queue.length > 0 ? 'var(--amber-500)' : 'var(--ink-400)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Stat value={queue.length} label={queue.length === 1 ? 'design in queue' : 'designs in queue'} color={color} />
      {running && (
        <>
          <MiniBar pct={progress.pct} color="var(--amber-500)" />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚙ {progress.step} — {progress.pct}%
          </div>
        </>
      )}
    </div>
  )
}

function NovaSummary({ trends }) {
  const items = trends?.trends ?? []
  const latest = items[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Stat value={items.length} label="niches researched" color="var(--mint-500)" />
      {latest
        ? <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>Latest: {latest.niche}</div>
        : <div style={{ fontSize: 11, color: 'var(--ink-500)', fontStyle: 'italic' }}>No research yet — click to run Nova</div>
      }
    </div>
  )
}

function ArchivesSummary({ queue, publishProgress }) {
  const urgent = queue.length > 0
  const pub = publishProgress
  const publishing = pub?.running
  const justDone = !pub?.running && pub?.step === 'done' && pub?.drafts_created > 0
  const pubError = !pub?.running && pub?.step === 'error'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Stat value={queue.length} label="awaiting review" color={urgent ? 'var(--rose-500)' : 'var(--ink-400)'} />

      {/* Publish pipeline status */}
      {publishing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Publishing to Printify…
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-600)', lineHeight: 1.4 }}>
            {pub.design_name && <span style={{ fontWeight: 600 }}>{pub.design_name}</span>}
            {pub.current_product && <span> → {pub.current_product}</span>}
          </div>
          {pub.products_total > 0 && (
            <div style={{ height: 3, background: 'var(--paper-200)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'var(--violet-500)',
                width: `${Math.round((pub.products_done / pub.products_total) * 100)}%`,
                transition: 'width 0.4s ease' }} />
            </div>
          )}
        </div>
      )}
      {justDone && (
        <div style={{ fontSize: 10, color: 'var(--mint-500)', fontWeight: 700 }}>
          ✓ {pub.drafts_created} draft{pub.drafts_created !== 1 ? 's' : ''} created on Printify
        </div>
      )}
      {pubError && (
        <div style={{ fontSize: 10, color: 'var(--coral-500)' }}>
          ✕ Publish failed — {pub.error?.slice(0, 60)}
        </div>
      )}

      {urgent && !publishing && (
        <div style={{ display: 'flex', gap: 4 }}>
          {queue.slice(0, 5).map(d => (
            d.image_url
              ? <img key={d.id} src={d.image_url} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover' }} />
              : <div key={d.id} style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🎨</div>
          ))}
          {queue.length > 5 && <div style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-500)', fontWeight: 700 }}>+{queue.length - 5}</div>}
        </div>
      )}
    </div>
  )
}

function TreasurySummary({ spend }) {
  const total = spend?.today_usd ?? 0
  const limit = 10
  const pct = Math.min((total / limit) * 100, 100)
  const color = pct > 80 ? 'var(--coral-500)' : pct > 50 ? 'var(--amber-500)' : 'var(--mint-500)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Stat value={`$${Number(total).toFixed(2)}`} label={`of $${limit} daily limit`} color={color} />
      <MiniBar pct={pct} color={color} />
    </div>
  )
}

function ActivitySummary({ status, activity }) {
  const agents = status?.agents ?? []
  const recent = activity?.items?.slice(0, 3) ?? []
  const total = activity?.items?.length ?? 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {agents.map(a => (
          <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: a.status === 'online' ? 'var(--mint-500)' : 'var(--ink-300)' }} />
            <span style={{ fontSize: 10, color: 'var(--ink-700)', fontWeight: 600 }}>{a.name}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>{total} event{total !== 1 ? 's' : ''} logged</div>
      {recent.map((item, i) => (
        <div key={i} style={{ fontSize: 10, color: 'var(--ink-500)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.agent ? <span style={{ color: AGENT_COLORS[item.agent] ?? 'var(--ink-400)', fontWeight: 700, marginRight: 4 }}>[{item.agent}]</span> : null}
          {item.summary || item.message || '—'}
        </div>
      ))}
    </div>
  )
}

const AGENT_COLORS = {
  nova: 'var(--mint-500)',
  forge: 'var(--amber-500)',
  archives: 'var(--rose-500)',
  printify: 'var(--violet-500)',
  ellie: 'var(--violet-500)',
  treasury: 'var(--peach-500)',
}

// ── Activity room (for expanded modal) ───────────────────────────────────────
function ActivityRoom({ status, activity }) {
  const agents = status?.agents ?? []
  const alerts = status?.alerts ?? []
  const items = activity?.items ?? []

  const fmtTime = (ts) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Agent status row */}
      <div>
        <Label>Agent Status</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {agents.length === 0
            ? <Empty>No agent data</Empty>
            : agents.map(a => (
              <div key={a.name} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', background: 'var(--paper-100)',
                border: '1px solid var(--paper-200)', borderRadius: 99,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 99, background: a.status === 'online' ? 'var(--mint-500)' : a.status === 'error' ? 'var(--coral-500)' : 'var(--ink-300)' }} />
                <span style={{ fontSize: 11, color: 'var(--ink-800)', fontWeight: 600 }}>{a.name}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Event log */}
      <div style={{ flex: 1 }}>
        <Label>Event Log ({items.length})</Label>
        {items.length === 0
          ? <Empty>No activity yet — run a pipeline to see events here</Empty>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {items.map((item, i) => {
                const agentColor = AGENT_COLORS[item.agent] ?? 'var(--ink-400)'
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '6px 0', borderBottom: '1px solid var(--paper-200)',
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: agentColor, minWidth: 44, paddingTop: 1,
                    }}>{item.agent || '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-700)', flex: 1, lineHeight: 1.4 }}>
                      {item.summary || item.message || '—'}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {fmtTime(item.ts)}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {alerts.length > 0 && (
        <div>
          <Label>Alerts</Label>
          {alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--coral-500)', padding: '4px 0' }}>{a.msg || a.message || a}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Product Maker modal ───────────────────────────────────────────────────────
const STATUS_BADGE_COLOR = {
  approved: 'var(--mint-500)',
  draft_on_printify: 'var(--violet-500)',
  listed: 'var(--sky-500, #38bdf8)',
  pending_drew_review: 'var(--amber-500)',
}

function ProductMakerModal({ visible, onClose }) {
  const [designs, setDesigns] = useState([])
  const [catalog, setCatalog] = useState([])
  const [selectedDesigns, setSelectedDesigns] = useState(new Set())
  const [selectedProducts, setSelectedProducts] = useState(new Set())
  const [queue, setQueue] = useState([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!visible) return
    Promise.all([
      api.get('/business/products/designs', { params: { limit: 60 } }),
      api.get('/business/products/catalog'),
    ]).then(([d, c]) => {
      setDesigns(d.data?.designs ?? [])
      setCatalog(c.data?.products ?? [])
    }).catch(() => {})
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const fn = e => { if (e.key === 'Escape' && !running) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [visible, onClose, running])

  const toggleDesign = id => setSelectedDesigns(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleProduct = key => setSelectedProducts(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const runBatch = async () => {
    const designList = designs.filter(d => selectedDesigns.has(d.id))
    const productList = [...selectedProducts]
    const combos = designList.flatMap(d =>
      productList.map(p => ({
        key: `${d.id}:${p}`,
        design: d,
        product: p,
        productLabel: catalog.find(c => c.key === p)?.label ?? p,
        status: 'pending',
        result: null,
      }))
    )
    setQueue(combos)
    setRunning(true)

    for (let i = 0; i < combos.length; i++) {
      setQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'generating' } : item))
      try {
        const copyRes = await api.post('/business/products/generate_copy', {
          design_id: combos[i].design.id,
          product_type: combos[i].product,
        })
        const copy = copyRes.data
        if (copy.error) throw new Error(copy.error)

        setQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'creating' } : item))

        const draftRes = await api.post('/business/products/create_draft', {
          design_id: combos[i].design.id,
          product_type: combos[i].product,
          title: copy.title,
          description: copy.description,
          tags: copy.tags || [],
          price_usd: copy.price_usd || 19.99,
        })
        setQueue(q => q.map((item, idx) => idx === i ? {
          ...item,
          status: draftRes.data.ok ? 'done' : 'error',
          result: draftRes.data,
        } : item))
      } catch (e) {
        setQueue(q => q.map((item, idx) => idx === i ? {
          ...item, status: 'error', result: { error: e.message },
        } : item))
      }
    }
    setRunning(false)
  }

  const total = selectedDesigns.size * selectedProducts.size
  const canRun = total > 0 && !running
  const inQueue = queue.length > 0
  const doneCount = queue.filter(i => i.status === 'done').length
  const completedCount = queue.filter(i => i.status === 'done' || i.status === 'error').length

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(10,8,15,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget && !running) onClose() }}
    >
      <div style={{
        background: 'var(--paper-50)', border: '1.5px solid var(--ink-300)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 960,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 100px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderBottom: '1px solid var(--paper-200)',
          background: 'var(--paper-100)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>⚒</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-900)', flex: 1 }}>Product Maker</span>
          <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>
            {inQueue
              ? running ? `Creating listings… ${completedCount}/${queue.length}` : `Done — ${doneCount}/${queue.length} succeeded`
              : 'Select designs + products → ELLIE writes listings → straight to Printify'}
          </span>
          {!running && (
            <button onClick={onClose} style={{
              marginLeft: 12, background: 'none', border: '1.5px solid var(--ink-300)',
              borderRadius: 'var(--radius-sm)', color: 'var(--ink-600)', cursor: 'pointer',
              padding: '4px 14px', fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 700,
            }}>✕ <span style={{ fontSize: 10, opacity: 0.5 }}>Esc</span></button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {!inQueue ? (
            <>
              {/* Pickers row */}
              <div style={{ display: 'flex', gap: 20 }}>

                {/* Design picker */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Label>
                    1 · Select Designs
                    <span style={{ fontWeight: 400, color: 'var(--ink-400)', marginLeft: 6 }}>
                      {selectedDesigns.size > 0 ? `${selectedDesigns.size} selected` : ''}
                    </span>
                  </Label>
                  {designs.length === 0
                    ? <Empty>No designs yet — run Forge first</Empty>
                    : (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                        gap: 8, maxHeight: 340, overflowY: 'auto', paddingRight: 4,
                      }}>
                        {designs.map(d => {
                          const sel = selectedDesigns.has(d.id)
                          return (
                            <div
                              key={d.id}
                              onClick={() => toggleDesign(d.id)}
                              style={{
                                position: 'relative', borderRadius: 'var(--radius-md)',
                                overflow: 'hidden', cursor: 'pointer',
                                border: `2px solid ${sel ? 'var(--violet-500)' : 'transparent'}`,
                                boxShadow: sel ? '0 0 0 3px rgba(122,110,142,0.2)' : 'none',
                                background: 'var(--paper-100)', transition: 'border-color 0.12s, box-shadow 0.12s',
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 4, right: 4, zIndex: 2,
                                width: 16, height: 16, borderRadius: 4,
                                background: sel ? 'var(--violet-500)' : 'rgba(0,0,0,0.45)',
                                border: sel ? 'none' : '1px solid rgba(255,255,255,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, color: 'white', fontWeight: 700,
                              }}>
                                {sel && '✓'}
                              </div>
                              {d.image_url
                                ? <img src={d.image_url} alt={d.concept_name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                                : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎨</div>
                              }
                              <div style={{ padding: '4px 5px' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-700)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {d.concept_name}
                                </div>
                                <div style={{ fontSize: 8, color: STATUS_BADGE_COLOR[d.status] ?? 'var(--ink-400)', marginTop: 1, fontWeight: 600 }}>
                                  {d.status?.replace(/_/g, ' ')}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                </div>

                {/* Product picker */}
                <div style={{ width: 230, flexShrink: 0 }}>
                  <Label>
                    2 · Select Products
                    <span style={{ fontWeight: 400, color: 'var(--ink-400)', marginLeft: 6 }}>
                      {selectedProducts.size > 0 ? `${selectedProducts.size} selected` : ''}
                    </span>
                  </Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
                    {catalog.map(c => {
                      const sel = selectedProducts.has(c.key)
                      return (
                        <div
                          key={c.key}
                          onClick={() => toggleProduct(c.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: sel ? 'rgba(122,110,142,0.10)' : 'var(--paper-100)',
                            border: `1px solid ${sel ? 'var(--violet-500)' : 'var(--paper-200)'}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                            background: sel ? 'var(--violet-500)' : 'transparent',
                            border: `1.5px solid ${sel ? 'var(--violet-500)' : 'var(--ink-400)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: 'white', fontWeight: 700,
                          }}>
                            {sel && '✓'}
                          </div>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? 'var(--ink-900)' : 'var(--ink-700)' }}>
                            {c.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--mint-500)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            ${c.price_usd.toFixed(0)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Summary + run */}
              <div style={{
                borderTop: '1px solid var(--paper-200)', paddingTop: 16,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  {total > 0 ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-800)' }}>
                      <span style={{ color: 'var(--violet-500)' }}>{selectedDesigns.size}</span> design{selectedDesigns.size !== 1 ? 's' : ''}{' '}
                      ×{' '}
                      <span style={{ color: 'var(--violet-500)' }}>{selectedProducts.size}</span> product{selectedProducts.size !== 1 ? 's' : ''}{' '}
                      ={' '}
                      <span style={{ color: 'var(--mint-500)' }}>{total} listing{total !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>
                      Select at least one design and one product to continue.
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--ink-400)', marginTop: 3 }}>
                    ELLIE auto-generates listing copy for each combination.
                  </div>
                </div>
                <Btn onClick={runBatch} disabled={!canRun} color="var(--mint-500)">
                  → Create {total > 0 ? `${total} ` : ''}Listing{total !== 1 ? 's' : ''}
                </Btn>
              </div>
            </>
          ) : (
            /* Queue view */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-800)' }}>
                  {running
                    ? `Processing ${completedCount} / ${queue.length}…`
                    : `Done — ${doneCount} of ${queue.length} created successfully`}
                </div>
                {!running && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => { setQueue([]); setSelectedDesigns(new Set()); setSelectedProducts(new Set()) }} color="var(--violet-500)">
                      ← Make More
                    </Btn>
                    <Btn onClick={onClose} color="var(--ink-400)">✕ Close</Btn>
                  </div>
                )}
              </div>

              {queue.map(item => {
                const statusColor = {
                  pending: 'var(--ink-400)', generating: 'var(--amber-500)',
                  creating: 'var(--violet-500)', done: 'var(--mint-500)', error: 'var(--coral-500)',
                }[item.status]
                const statusLabel = {
                  pending: '···', generating: '⏳ Writing copy…',
                  creating: '⏳ Sending to Printify…', done: '✓ Created', error: '✕ Failed',
                }[item.status]
                return (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--paper-100)',
                    border: `1px solid ${item.status === 'done' ? 'var(--mint-500)' : item.status === 'error' ? 'var(--coral-500)' : 'var(--paper-200)'}`,
                  }}>
                    {item.design.image_url
                      ? <img src={item.design.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--paper-200)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎨</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-900)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {item.design.concept_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>{item.productLabel}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, whiteSpace: 'nowrap' }}>
                      {statusLabel}
                    </div>
                    {item.result?.error && (
                      <div style={{ fontSize: 9, color: 'var(--coral-500)', maxWidth: 180, textAlign: 'right', lineHeight: 1.3 }}>
                        {item.result.error}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main BusinessFactory ──────────────────────────────────────────────────────
export default function BusinessFactory() {
  const [status,        setStatus]        = useState(null)
  const [activity,      setActivity]      = useState(null)
  const [queue,         setQueue]         = useState([])
  const [trends,        setTrends]        = useState(null)
  const [spend,         setSpend]         = useState(null)
  const [forgeProgress,     setForgeProgress]     = useState(null)
  const [elliePipeline,     setElliePipeline]     = useState(null)
  const [ellieRoomStatus,   setEllieRoomStatus]   = useState({ thinking: false, plan: null, strategyReport: null, exploreReport: null, pipeline: null })
  const [publishProgress,   setPublishProgress]   = useState(null)
  const [pipelineRuns,      setPipelineRuns]      = useState([])
  const [paused,            setPaused]            = useState(false)
  const [loading,           setLoading]           = useState(true)
  const [expanded,          setExpanded]          = useState(null)
  const [showWorkshop,      setShowWorkshop]      = useState(false)

  const fetchAll = useCallback(async () => {
    const [s, act, q, tr, sp, fp, ep, pp, runs] = await Promise.all([
      api.get('/business/status').catch(() => null),
      api.get('/business/activity', { params: { limit: 40 } }).catch(() => null),
      api.get('/business/forge/queue', { params: { limit: 20 } }).catch(() => null),
      api.get('/business/nova/trends', { params: { limit: 5 } }).catch(() => null),
      api.get('/business/treasury/spend').catch(() => null),
      api.get('/business/forge/progress').catch(() => null),
      api.get('/business/ellie/pipeline').catch(() => null),
      api.get('/business/archives/publish_progress').catch(() => null),
      api.get('/business/ellie/pipeline/runs', { params: { limit: 20 } }).catch(() => null),
    ])
    setStatus(s?.data ?? null)
    setActivity(act?.data ?? null)
    setQueue(q?.data?.designs ?? [])
    setTrends(tr?.data ?? null)
    setSpend(sp?.data ?? null)
    setForgeProgress(fp?.data ?? null)
    setElliePipeline(ep?.data ?? null)
    setPublishProgress(pp?.data ?? null)
    setPipelineRuns(runs?.data?.runs ?? [])
    setPaused(s?.data?.paused ?? false)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 8000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const togglePause = async () => {
    await api.post(paused ? '/business/resume' : '/business/pause', {}).catch(() => null)
    setPaused(p => !p)
  }

  const handleForgeRun = async (niche, nConcepts) => {
    await api.post('/business/forge/run', { niche, n_concepts: nConcepts }).catch(() => null)
    setTimeout(fetchAll, 2000)
  }

  const handleNovaRun = async () => {
    await api.post('/business/nova/run').catch(() => null)
    setTimeout(fetchAll, 3000)
  }

  const handleVerdict = async (designId, verdict) => {
    await api.post('/business/archives/feedback', {
      target_kind: 'design', target_id: designId, verdict, notes: '',
    }).catch(() => null)
    setQueue(q => q.filter(d => d.id !== designId))
  }

  const handleRerun = async (runId) => {
    await api.post(`/business/ellie/pipeline/runs/${runId}/rerun`).catch(() => null)
    setTimeout(fetchAll, 1000)
  }

  const handlePublishAll = async () => {
    await api.post('/business/archives/publish_all').catch(() => null)
    setTimeout(fetchAll, 1500)
  }

  const handleRunNovaManual = async () => {
    await api.post('/business/nova/run').catch(() => null)
    setTimeout(fetchAll, 3000)
  }

  const handleRunForgeManual = async () => {
    await api.post('/business/forge/run', { niche: 'trending niches', n_concepts: 3 }).catch(() => null)
    setTimeout(fetchAll, 2000)
  }

  const pendingCount = queue.length
  const spendToday = spend?.today_usd ?? 0

  return (
    <RoomShell
      title="Business Factory"
      gradient="var(--grad-violet)"
      icon="⚙️"
      contentStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      actions={
        <>
          <StatusPill status={loading ? 'offline' : paused ? 'paused' : 'online'} />
          {pendingCount > 0 && (
            <span style={{
              background: 'rgba(255,107,168,0.15)', border: '1px solid var(--rose-500)',
              borderRadius: 'var(--radius-full)', color: 'var(--rose-500)',
              fontWeight: 700, fontSize: 11, padding: '3px 10px',
            }}>{pendingCount} to review</span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>
            ${Number(spendToday).toFixed(2)} today
          </span>
          <button onClick={() => setShowWorkshop(true)} style={{
            background: 'rgba(122,110,142,0.1)',
            border: '1.5px solid var(--violet-500)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--violet-500)',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--text-sm)',
            padding: '6px 16px', cursor: 'pointer',
          }}>⚒ Workshop</button>
          <button onClick={togglePause} disabled={loading} style={{
            background: paused ? 'rgba(34,211,164,0.1)' : 'rgba(255,178,63,0.1)',
            border: `1.5px solid ${paused ? 'var(--mint-500)' : 'var(--amber-500)'}`,
            borderRadius: 'var(--radius-md)',
            color: paused ? 'var(--mint-500)' : 'var(--amber-500)',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--text-sm)',
            padding: '6px 16px', cursor: loading ? 'not-allowed' : 'pointer',
          }}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
        </>
      }
    >
      {/* Pipeline stages bar — only shown when active */}
      <PipelineBar pipeline={elliePipeline} queue={queue} publishProgress={publishProgress} />

      {/* Dashboard card grid — equal 3×2 cards, click any to expand */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 12,
        padding: '12px 16px',
      }}>
        <CompactCard id="ellie" icon="🧠" name="ELLIE" accent="var(--violet-500)"
          status={ellieRoomStatus.thinking ? 'online' : (ellieRoomStatus.pipeline ?? elliePipeline)?.running ? 'online' : status?.agents?.find(a => a.name === 'ELLIE')?.status ?? 'idle'}
          onExpand={setExpanded}>
          <EllieSummary status={status} pipeline={elliePipeline} roomStatus={ellieRoomStatus} />
        </CompactCard>

        <CompactCard id="forge" icon="🔨" name="Forge · Design Room" accent="var(--amber-500)"
          status={forgeProgress?.running ? 'online' : queue.length > 0 ? 'online' : 'idle'}
          onExpand={setExpanded}>
          <ForgeSummary queue={queue} progress={forgeProgress} />
        </CompactCard>

        <CompactCard id="nova" icon="🔭" name="Nova · Research" accent="var(--mint-500)"
          status={(trends?.trends?.length ?? 0) > 0 ? 'online' : 'idle'}
          onExpand={setExpanded}>
          <NovaSummary trends={trends} />
        </CompactCard>

        <CompactCard id="archives" icon="🗄️" name="Archives" accent="var(--rose-500)"
          status={publishProgress?.running ? 'online' : queue.length > 0 ? 'alert' : 'online'}
          badge={queue.length > 0 && (
            <span style={{ background: 'rgba(255,107,168,0.15)', border: '1px solid var(--rose-500)', borderRadius: 99, color: 'var(--rose-500)', fontSize: 10, fontWeight: 700, padding: '1px 8px' }}>
              {queue.length}
            </span>
          )}
          onExpand={setExpanded}>
          <ArchivesSummary queue={queue} publishProgress={publishProgress} />
        </CompactCard>

        <CompactCard id="treasury" icon="💰" name="Treasury" accent="var(--peach-500)"
          status="online" onExpand={setExpanded}>
          <TreasurySummary spend={spend} />
        </CompactCard>

        <CompactCard id="activity" icon="📊" name="Activity" accent="var(--sky-500, #38bdf8)"
          status={status?.agents?.some(a => a.status === 'online') ? 'online' : 'idle'}
          onExpand={setExpanded}>
          <ActivitySummary status={status} activity={activity} />
        </CompactCard>
      </div>

      {/* Always-mounted room modals — state is preserved when closed */}
      <RoomModal icon="🧠" title="ELLIE" visible={expanded === 'ellie'} onClose={() => setExpanded(null)}>
        <EllieRoom
          status={status} activity={activity} onRefresh={fetchAll} onStatusUpdate={setEllieRoomStatus}
          onRunNova={handleRunNovaManual} onRunForge={handleRunForgeManual} onPublishAll={handlePublishAll}
        />
      </RoomModal>
      <RoomModal icon="🔨" title="Forge · Design Room" wide visible={expanded === 'forge'} onClose={() => setExpanded(null)}>
        <ForgeRoom queue={queue} onRun={handleForgeRun} onVerdict={handleVerdict} onRefresh={fetchAll} paused={paused} />
      </RoomModal>
      <RoomModal icon="🔭" title="Nova · Research" visible={expanded === 'nova'} onClose={() => setExpanded(null)}>
        <NovaRoom trends={trends} onRun={handleNovaRun} />
      </RoomModal>
      <RoomModal icon="🗄️" title="Archives" wide visible={expanded === 'archives'} onClose={() => setExpanded(null)}>
        <ArchivesRoom queue={queue} onVerdict={handleVerdict} runs={pipelineRuns} onRerun={handleRerun} />
      </RoomModal>
      <RoomModal icon="💰" title="Treasury" visible={expanded === 'treasury'} onClose={() => setExpanded(null)}>
        <TreasuryRoom spend={spend} />
      </RoomModal>
      <RoomModal icon="📊" title="Activity" visible={expanded === 'activity'} onClose={() => setExpanded(null)}>
        <ActivityRoom status={status} activity={activity} />
      </RoomModal>

      <ProductMakerModal visible={showWorkshop} onClose={() => setShowWorkshop(false)} />
    </RoomShell>
  )
}
