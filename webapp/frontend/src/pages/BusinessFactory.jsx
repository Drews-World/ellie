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
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-300)', fontStyle: 'italic' }}>{children}</p>
}

// ── ELLIE supervisor room ─────────────────────────────────────────────────────
function StrategyReport({ report, onRunProposal, onDismiss }) {
  const scoreColor = s => s >= 0.8 ? 'var(--mint-500)' : s >= 0.6 ? 'var(--gold-500, #f59e0b)' : 'var(--ink-400)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--mint-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Strategy Report
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

function EllieRoom({ status, activity, onRefresh }) {
  const agentStatus = status?.agents?.find(a => a.name === 'ELLIE')?.status ?? 'idle'
  const spend = status?.metrics?.find(m => m.label === 'Spend today')?.value ?? '—'

  const [cmd, setCmd] = useState('')
  const [thinking, setThinking] = useState(false)
  const [plan, setPlan] = useState(null)
  const [strategyReport, setStrategyReport] = useState(null)
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
    try {
      const res = await api.post('/business/ellie/command', { message: cmd })
      const data = res.data
      if (data.command_type === 'strategy') {
        setStrategyReport(data.report)
      } else {
        setPlan(data.plan)
      }
    } catch (e) {
      setPlan({ error: 'Failed to reach ELLIE' })
    }
    setThinking(false)
  }

  const confirmPlan = async (planToRun) => {
    const p = planToRun || plan
    setConfirming(true)
    try {
      await api.post('/business/ellie/confirm', { plan: p })
      setPipeline({ running: true, step: 'starting', detail: 'ELLIE is spinning up the pipeline…', pct: 0 })
      startPipelinePoll()
      setPlan(null)
      setStrategyReport(null)
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
            <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.4 }}>{pipeline.detail}</div>
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

        {/* Plan confirmation card */}
        {plan && !plan.error && (
          <div style={{ background: 'rgba(122,110,142,0.07)', border: '1.5px solid var(--violet-500)',
            borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ELLIE's Plan
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-800)', fontWeight: 600, lineHeight: 1.4 }}>
              {plan.understood_intent}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.5 }}>
              {plan.interpretation}
            </div>
            {plan.niches?.map((n, i) => (
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
              <Btn onClick={() => confirmPlan()} disabled={confirming} color="var(--violet-500)">
                {confirming ? '⏳ Starting…' : '✓ Run it'}
              </Btn>
              <Btn onClick={() => setPlan(null)} color="var(--ink-400)">✕ Cancel</Btn>
            </div>
          </div>
        )}
        {plan?.error && (
          <div style={{ fontSize: 11, color: 'var(--coral-500)' }}>{plan.error}</div>
        )}

        {/* Command input */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Tell ELLIE what to do</Label>
          <textarea
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand() } }}
            placeholder="e.g. lets focus on cats and Jesus… or: what should we make next?"
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
            <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.4 }}>{progress.detail}</div>
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
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-900)', marginBottom: 3 }}>{t.niche}</div>
              {t.opportunity && (
                <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.4 }}>{t.opportunity}</div>
              )}
              {t.avg_price_usd && (
                <div style={{ fontSize: 10, color: 'var(--mint-500)', marginTop: 4, fontWeight: 700 }}>
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
function ArchivesRoom({ queue, onVerdict }) {
  return (
    <Room icon="🗄️" name="Archives · Review Queue" accent="var(--rose-500)"
      status={queue.length > 0 ? 'alert' : 'online'}
      style={{ gridArea: 'archives' }}>

      {queue.length === 0
        ? <Empty>Queue clear — no designs awaiting review</Empty>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 6 }}>
                    {d.niche} · score {((d.forge_score ?? 0) * 100).toFixed(0)}%
                  </div>
                  {d.sell_reason && (
                    <div style={{ fontSize: 10, color: 'var(--ink-400)', marginBottom: 6, fontStyle: 'italic', lineHeight: 1.3 }}>{d.sell_reason}</div>
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
      }
    </Room>
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

// ── Main BusinessFactory ──────────────────────────────────────────────────────
export default function BusinessFactory() {
  const [status,   setStatus]   = useState(null)
  const [activity, setActivity] = useState(null)
  const [queue,    setQueue]    = useState([])
  const [trends,   setTrends]   = useState(null)
  const [spend,    setSpend]    = useState(null)
  const [paused,   setPaused]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  const fetchAll = useCallback(async () => {
    const [s, act, q, tr, sp] = await Promise.all([
      api.get('/business/status').catch(() => null),
      api.get('/business/activity', { params: { limit: 20 } }).catch(() => null),
      api.get('/business/forge/queue', { params: { limit: 20 } }).catch(() => null),
      api.get('/business/nova/trends', { params: { limit: 5 } }).catch(() => null),
      api.get('/business/treasury/spend').catch(() => null),
    ])
    setStatus(s?.data ?? null)
    setActivity(act?.data ?? null)
    setQueue(q?.data?.designs ?? [])
    setTrends(tr?.data ?? null)
    setSpend(sp?.data ?? null)
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

  const pendingCount = queue.length
  const spendToday = spend?.today_usd ?? 0

  return (
    <RoomShell
      title="Business Factory"
      gradient="var(--grad-violet)"
      icon="⚙️"
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
      {/* Floor plan grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 260px',
        gridTemplateRows: 'auto auto',
        gridTemplateAreas: `
          "ellie forge nova"
          "archives archives treasury"
        `,
        gap: 16,
      }}>
        {/* ELLIE */}
        <EllieRoom status={status} activity={activity} onRefresh={fetchAll} />

        {/* FORGE */}
        <ForgeRoom
          queue={queue}
          onRun={handleForgeRun}
          onVerdict={handleVerdict}
          onRefresh={fetchAll}
          paused={paused}
        />

        {/* NOVA */}
        <div style={{ gridArea: 'nova' }}>
          <NovaRoom trends={trends} onRun={handleNovaRun} />
        </div>

        {/* ARCHIVES */}
        <ArchivesRoom queue={queue} onVerdict={handleVerdict} />

        {/* TREASURY */}
        <TreasuryRoom spend={spend} />
      </div>
    </RoomShell>
  )
}
