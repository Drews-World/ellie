// Trading floor crew visualization — replaces the old craftpix-sprite AgentFeed.
// Renders the shared CrewGraph + agent cards from the live analysis run state.
import CrewGraph from '../../components/crew/CrewGraph'
import AgentCard from '../../components/crew/AgentCard'
import { TRADING_CREW } from '../../components/crew/crews'

const ELLIE_FACE = '/sprites/EllieSprite/EllieHeadshot.png'

// What each agent is doing while running / when done.
const ACTIVITY = {
  market:           { working: 'Scanning price history & technicals…', done: 'Market report ready' },
  social:           { working: 'Reading Reddit & StockTwits…',         done: 'Sentiment report ready' },
  news:             { working: 'Scanning headlines & press…',          done: 'News report ready' },
  fundamentals:     { working: 'Pulling filings & earnings…',          done: 'Fundamentals report ready' },
  bull_researcher:  { working: 'Building the bull case…',              done: 'Bull thesis complete' },
  bear_researcher:  { working: 'Building the bear case…',              done: 'Bear thesis complete' },
  research_manager: { working: 'Judging the debate…',                  done: 'Research decision made' },
  trader:           { working: 'Forming the trade plan…',              done: 'Trade plan ready' },
  aggressive:       { working: 'Pushing for exposure…',                done: 'Aggressive view ready' },
  conservative:     { working: 'Weighing the downside…',               done: 'Conservative view ready' },
  neutral:          { working: 'Balancing risk/reward…',               done: 'Neutral view ready' },
  portfolio_manager:{ working: 'Making the final call…',               done: 'Decision delivered' },
}

function liveStatus(id, agents) {
  const s = agents[id]?.status
  if (s === 'running') return 'working'
  if (s === 'done') return 'done'
  return 'idle'
}

function activityText(id, status) {
  const a = ACTIVITY[id]
  if (status === 'working') return a?.working || 'Working…'
  if (status === 'done') return a?.done || 'Complete'
  return 'On standby'
}

export default function TradingCrew({ agents = {}, activeAgent, statusMsg, isRunning, onSelectAgent, selectedAgent }) {
  const statusByAgent = {}
  for (const a of TRADING_CREW.agents) statusByAgent[a.id] = liveStatus(a.id, agents)
  const activeId = activeAgent || TRADING_CREW.agents.find(a => statusByAgent[a.id] === 'working')?.id || null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bp-ink)' }}>Operations floor</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--bp-font-mono)',
          fontSize: 11, color: 'var(--bp-ink-muted)' }}>
          {isRunning && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bp-accent)',
            boxShadow: '0 0 8px var(--bp-accent)', animation: 'bp-glow-breathe 1.6s ease-in-out infinite' }} />}
          {statusMsg || 'Click an agent to see what it does and its latest output'}
        </div>
      </div>

      <CrewGraph
        crew={TRADING_CREW}
        statusByAgent={statusByAgent}
        activeId={activeId}
        selectedId={selectedAgent}
        onSelect={onSelectAgent}
        ellieFace={ELLIE_FACE}
      />

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {TRADING_CREW.agents.map(a => {
          const status = statusByAgent[a.id]
          return (
            <AgentCard key={a.id} agent={a} status={status}
              activity={activityText(a.id, status)}
              selected={selectedAgent === a.id} onSelect={onSelectAgent} />
          )
        })}
      </div>
    </section>
  )
}
