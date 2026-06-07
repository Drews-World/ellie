import { useState, useCallback } from 'react'
import api from '../lib/api'
import { Surface, Button, Tag, SectionHeader, StatusPill } from '../components/ui'
import CrewGraph from '../components/crew/CrewGraph'
import AgentCard from '../components/crew/AgentCard'
import AgentDetailDrawer from '../components/crew/AgentDetailDrawer'
import ActivityTimeline from '../components/crew/ActivityTimeline'
import { useBusinessCrew } from '../components/crew/useCrew'
import { BUSINESS_CREW, agentIndex } from '../components/crew/crews'

const ELLIE_FACE = '/sprites/EllieSprite/EllieHeadshot.png'
const FORGE_STEPS = new Set(['starting', 'designing', 'imaging', 'concepts', 'scoring', 'saving'])

// Short live activity line per agent, for the cards.
function activityFor(id, status, pipeline) {
  if (status === 'working') {
    if (id === 'nova') return 'Scanning Etsy trends & niches…'
    if (id === 'forge') return `Generating concepts${pipeline?.detail ? ` — ${pipeline.detail}` : '…'}`
    if (id === 'archives') return 'Publishing to Etsy / Printify…'
    if (id === 'ellie') return pipeline?.detail || 'Running the pipeline…'
    return 'Working…'
  }
  if (status === 'talking') return 'Handing off…'
  if (status === 'done') return 'Finished its last run'
  if (status === 'error') return 'Hit an error'
  return 'On standby'
}

function pipelineActiveIndex(pipeline) {
  if (!pipeline) return -1
  const s = pipeline.step
  if (s === 'researching') return 0
  if (FORGE_STEPS.has(s)) return 1
  if (s === 'notifying') return 2
  if (s === 'done') return 3
  return pipeline.running ? 0 : -1
}

// ── Pipeline strip ────────────────────────────────────────────────────────────
function PipelineBar({ pipeline }) {
  const active = pipelineActiveIndex(pipeline)
  const running = !!pipeline?.running
  const err = pipeline?.step === 'error'
  return (
    <Surface padding={16} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 'var(--bp-text-2xs)',
        letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--bp-ink-muted)' }}>Pipeline</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, minWidth: 0, overflowX: 'auto' }}>
        {BUSINESS_CREW.pipeline.map((stage, i) => {
          const done = i < active
          const isActive = i === active
          const color = err && isActive ? 'var(--bp-coral)'
            : done ? 'var(--bp-sage)'
            : isActive ? 'var(--bp-accent)' : 'var(--bp-ink-faint)'
          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color,
                  boxShadow: isActive && running ? `0 0 8px ${color}` : 'none',
                  animation: isActive && running ? 'bp-glow-breathe 1.6s ease-in-out infinite' : 'none' }} />
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--bp-ink)' : 'var(--bp-ink-muted)' }}>{stage}</span>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 2, margin: '0 10px', borderRadius: 2,
                background: done ? 'var(--bp-sage)' : 'var(--bp-surface-3)' }} />}
            </div>
          )
        })}
      </div>
      <StatusPill status={err ? 'error' : running ? 'working' : active >= 0 ? 'done' : 'idle'}
        label={err ? 'Error' : running ? `${pipeline?.pct ?? 0}%` : active >= 0 ? 'Complete' : 'Standby'} />
    </Surface>
  )
}

// ── ELLIE command console ──────────────────────────────────────────────────────
function Chip({ children }) {
  return <Tag tone="ellie" style={{ marginRight: 4, marginBottom: 4 }}>{children}</Tag>
}

function StrategyReport({ report, onRun, onDismiss }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Header2 title="Strategy report" onDismiss={onDismiss}
        sub={report.niches_analyzed > 0 ? `Based on ${report.niches_analyzed} Nova reports` : 'Run Nova first for richer analysis'} />
      {report.summary && <p style={txt}>{report.summary}</p>}
      {report.top_niches?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {report.top_niches.map((n, i) => (
            <div key={i} style={subCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 12.5, color: 'var(--bp-ink)' }}>{n.niche}</strong>
                <span style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 11, color: 'var(--bp-accent-deep)' }}>
                  {Math.round((n.opportunity_score || 0) * 100)}%</span>
              </div>
              {n.reasoning && <p style={{ ...txt, fontSize: 11.5, margin: '4px 0 0' }}>{n.reasoning}</p>}
            </div>
          ))}
        </div>
      )}
      {report.proposed_runs?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={secLabel}>Proposed Forge runs</div>
          {report.proposed_runs.map((r, i) => (
            <div key={i} style={subCard}>
              <strong style={{ fontSize: 12.5, color: 'var(--bp-ink)' }}>{r.niche}</strong>
              {r.rationale && <p style={{ ...txt, fontSize: 11.5, margin: '4px 0 8px' }}>{r.rationale}</p>}
              <Button size="sm" variant="ellie" onClick={() => onRun(r)}>Run Forge</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExploreReport({ discovery, onDesign, onDismiss }) {
  const opps = discovery?.opportunities || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Header2 title="Trend discovery" onDismiss={onDismiss}
        sub={opps.length ? `${opps.length} fresh niches from live Etsy research` : (discovery?.error || 'No opportunities found')} />
      {opps.map((opp, i) => (
        <div key={i} style={subCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ fontSize: 12.5, color: 'var(--bp-ink)' }}>
              {i === 0 && '★ '}{opp.niche}</strong>
            <span style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 11, color: 'var(--bp-accent-deep)' }}>
              {Math.round((opp.opportunity_score || 0) * 100)}%</span>
          </div>
          {opp.opportunity && <p style={{ ...txt, fontSize: 11.5, margin: '4px 0 8px' }}>{opp.opportunity}</p>}
          <div style={{ marginBottom: 8 }}>{opp.recommended_products?.map(p => <Chip key={p}>{p}</Chip>)}</div>
          <Button size="sm" variant="ellie" onClick={() => onDesign(opp)}>→ Design this</Button>
        </div>
      ))}
    </div>
  )
}

function PlanCard({ plan, confirming, onConfirm, onDismiss }) {
  return (
    <div style={{ ...subCard, borderColor: 'var(--bp-ellie)' }}>
      <Header2 title={plan.command_type === 'repurpose' ? 'Repurpose plan' : "ELLIE's plan"} onDismiss={onDismiss} />
      {plan.understood_intent && <p style={{ ...txt, fontWeight: 600, color: 'var(--bp-ink)' }}>{plan.understood_intent}</p>}
      {plan.interpretation && <p style={{ ...txt, margin: '6px 0' }}>{plan.interpretation}</p>}
      {plan.niches?.length > 0 && (
        <div style={{ margin: '6px 0' }}>
          {plan.niches.map((n, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 12.5, color: 'var(--bp-ink)' }}>{n.name}</strong>
              <div style={{ marginTop: 4 }}>{n.suggested_products?.map(p => <Chip key={p}>{p}</Chip>)}</div>
            </div>
          ))}
        </div>
      )}
      <Button variant="ellie" onClick={() => onConfirm(plan)} disabled={confirming}
        style={{ marginTop: 8 }}>{confirming ? 'Starting…' : '✓ Confirm & run'}</Button>
    </div>
  )
}

function Header2({ title, sub, onDismiss }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={secLabel}>{title}</div>
        {sub && <p style={{ ...txt, fontSize: 11, margin: '2px 0 0', color: 'var(--bp-ink-muted)' }}>{sub}</p>}
      </div>
      {onDismiss && <button onClick={onDismiss} style={dismissBtn} aria-label="Dismiss">✕</button>}
    </div>
  )
}

function EllieConsole({ paused, onRan }) {
  const [cmd, setCmd] = useState('')
  const [thinking, setThinking] = useState(false)
  const [plan, setPlan] = useState(null)
  const [strategy, setStrategy] = useState(null)
  const [explore, setExplore] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState(null)

  const clear = () => { setPlan(null); setStrategy(null); setExplore(null); setErr(null) }

  const send = useCallback(async () => {
    if (!cmd.trim() || thinking) return
    setThinking(true); clear()
    try {
      const { data } = await api.post('/business/ellie/command', { message: cmd })
      if (data.command_type === 'strategy') setStrategy(data.report)
      else if (data.command_type === 'explore') setExplore(data.discovery)
      else setPlan(data.plan)
    } catch { setErr('Could not reach ELLIE. Check the business backend.') }
    setThinking(false)
  }, [cmd, thinking])

  const confirm = useCallback(async (p) => {
    setConfirming(true)
    try { await api.post('/business/ellie/confirm', { plan: p }); clear(); setCmd(''); onRan?.() }
    catch { setErr('Failed to start the pipeline.') }
    setConfirming(false)
  }, [onRan])

  const runProposal = (r) => confirm({
    command_type: 'design', understood_intent: `Run Forge for: ${r.niche}`, interpretation: r.rationale,
    niches: [{ name: r.niche, description: r.niche, suggested_products: r.products, n_concepts: r.n_concepts || 3, style_notes: '' }],
    market_reasoning: r.rationale,
  })
  const designOpp = (opp) => { setExplore(null); setPlan({
    command_type: 'design', understood_intent: `Design for: ${opp.niche}`, interpretation: opp.opportunity,
    niches: [{ name: opp.niche, description: opp.opportunity || opp.niche,
      suggested_products: opp.recommended_products?.length ? opp.recommended_products : ['t-shirt', 'mug', 'tote bag'],
      n_concepts: 3, style_notes: opp.style_themes?.join(', ') || '' }],
    market_reasoning: opp.opportunity }) }

  return (
    <Surface padding={18} glow style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={ELLIE_FACE} width={34} height={34} alt="ELLIE"
          style={{ borderRadius: '50%', border: '1.5px solid var(--bp-ellie)', boxShadow: 'var(--bp-shadow-ellie)' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bp-ink)' }}>Tell ELLIE what to make</div>
          <div style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 10, color: 'var(--bp-ink-muted)' }}>
            Supervisor · {paused ? 'paused' : 'online'}
          </div>
        </div>
      </div>

      <textarea
        value={cmd} onChange={e => setCmd(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
        placeholder='e.g. "design something for cottagecore gardeners" · "what should we make next?" · "explore trending niches"'
        rows={3}
        style={{
          width: '100%', resize: 'vertical', borderRadius: 'var(--bp-r-sm)',
          border: '1.5px solid var(--bp-hairline)', background: 'var(--bp-surface-2)',
          color: 'var(--bp-ink)', fontFamily: 'var(--bp-font-sans)', fontSize: 13, padding: '10px 12px',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ellie" onClick={send} disabled={thinking || !cmd.trim()}>
          {thinking ? 'ELLIE is thinking…' : 'Send to ELLIE'}
        </Button>
        {(plan || strategy || explore) && <Button variant="quiet" onClick={clear}>Clear</Button>}
      </div>

      {err && <p style={{ ...txt, color: 'var(--bp-coral)' }}>{err}</p>}
      {strategy && <StrategyReport report={strategy} onRun={runProposal} onDismiss={() => setStrategy(null)} />}
      {explore && <ExploreReport discovery={explore} onDesign={designOpp} onDismiss={() => setExplore(null)} />}
      {plan && <PlanCard plan={plan} confirming={confirming} onConfirm={confirm} onDismiss={() => setPlan(null)} />}
    </Surface>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function BusinessFactory() {
  const crew = useBusinessCrew()
  const [selected, setSelected] = useState(null)
  const idx = agentIndex(BUSINESS_CREW)

  const runNova = () => api.post('/business/nova/run').catch(() => {})
  const publishAll = () => api.post('/business/archives/publish_all').catch(() => {})

  return (
    <div className="biopunk" style={{ minHeight: '100%', padding: 'clamp(20px, 3vw, 40px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18,
        animation: 'bp-fade-up 0.5s var(--bp-ease) both' }}>

        {/* Header */}
        <SectionHeader
          kicker="Business Factory · Wing B"
          title="Agent crew"
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {crew.paused && <Tag tone="amber">Paused</Tag>}
              <Button variant="ghost" size="sm" onClick={runNova}>Run Nova</Button>
              <Button variant="ghost" size="sm" onClick={publishAll}>Publish all</Button>
            </div>
          }
        />

        <PipelineBar pipeline={crew.pipeline} />

        {/* Crew graph */}
        <CrewGraph
          crew={BUSINESS_CREW}
          statusByAgent={crew.statusByAgent}
          activeId={crew.activeId}
          selectedId={selected}
          onSelect={setSelected}
          ellieFace={ELLIE_FACE}
        />

        {/* Console + cards/timeline */}
        <div className="bf-main-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div>
              <SectionHeader title="The crew" style={{ marginBottom: 12 }} />
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {BUSINESS_CREW.agents.map(a => {
                  const status = crew.statusByAgent[a.id] ?? 'idle'
                  return (
                    <AgentCard key={a.id} agent={a} status={status}
                      activity={activityFor(a.id, status, crew.pipeline)}
                      selected={selected === a.id} onSelect={setSelected} />
                  )
                })}
              </div>
            </div>

            <Surface padding={18}>
              <SectionHeader title="Activity" style={{ marginBottom: 10 }} />
              <ActivityTimeline events={crew.events}
                emptyText={crew.offline ? 'Business backend offline.' : 'No recent activity.'} />
            </Surface>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ position: 'sticky', top: 12 }}>
              <EllieConsole paused={crew.paused} onRan={crew.refresh} />
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <AgentDetailDrawer
          crew={BUSINESS_CREW}
          agentId={selected}
          status={crew.statusByAgent[selected] ?? 'idle'}
          live={{ activity: activityFor(selected, crew.statusByAgent[selected] ?? 'idle', crew.pipeline) }}
          events={crew.events}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ── shared inline style fragments ─────────────────────────────────────────────
const txt = { fontSize: 12.5, lineHeight: 1.55, color: 'var(--bp-ink-2)', margin: 0 }
const secLabel = { fontFamily: 'var(--bp-font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--bp-accent-deep)' }
const subCard = { background: 'var(--bp-surface-2)', border: '1px solid var(--bp-hairline)',
  borderRadius: 'var(--bp-r-sm)', padding: '10px 12px' }
const dismissBtn = { background: 'none', border: '1px solid var(--bp-hairline)', borderRadius: 'var(--bp-r-pill)',
  width: 24, height: 24, color: 'var(--bp-ink-muted)', cursor: 'pointer', fontSize: 11, flexShrink: 0 }
