// ───────────────────────────────────────────────────────────────────────────
// Crew topology — the data model behind the live agent-crew visualization.
//
// Each agent declares id, name, role, what-it-does (`does`), a graph position
// (`x`/`y`, 0–100 in the CrewGraph's coordinate space), and a backend status key.
// Directed edges declare who feeds / hands off to whom. The shared <CrewGraph>
// renders nodes + edges from this; live status + active-link state is layered on
// at runtime by useCrew() from the EXISTING endpoints — this file is topology only.
//
// Rosters confirmed from the backends:
//   business → elliebusiness/agents/
//   trading  → ellietrading/tradingagents/agents/ (+ existing AgentFeed roster)
//
// `kind` drives an edge's visual treatment:
//   'flow'    solid pipeline hand-off (A produces → B consumes)
//   'steer'   dashed directive (A steers/plans for B)
//   'monitor' dashed oversight (A watches B, no hand-off)
//   'feedback'dotted return signal (realized results loop back)
//   'debate'  bidirectional contention (bull ↔ bear)
// ───────────────────────────────────────────────────────────────────────────

export const STATUS = {
  IDLE: 'idle',
  WORKING: 'working',
  WAITING: 'waiting',
  TALKING: 'talking',
  DONE: 'done',
  ERROR: 'error',
}

// ── Business Factory ─────────────────────────────────────────────────────────
// Flow: Strategist → Nova → Forge → Archives → Herald.
// Treasury monitors spend across all. ELLIE supervises. Realized Etsy sales
// loop back into Nova/Forge scoring.
export const BUSINESS_CREW = {
  id: 'business',
  label: 'Business Factory',
  accent: 'var(--bp-ellie)', // ELLIE-led floor leans on her signature
  agents: [
    { id: 'ellie', name: 'ELLIE', role: 'Supervisor', isEllie: true, x: 50, y: 14, statusKey: 'ELLIE',
      does: 'Orchestrates the crew: interprets your intent into a plan, kicks idle agents, pauses everything if Treasury hits the spend limit, and surfaces what needs your call.' },
    { id: 'strategist', name: 'Strategist', role: 'Planning', x: 12, y: 40, statusKey: 'Strategist',
      does: "Reads Nova's trend reports and the live catalog to decide what to make next — top niches, catalog gaps, and proposed Forge runs." },
    { id: 'nova', name: 'Nova', role: 'Market Research', x: 27, y: 60, statusKey: 'Nova',
      does: 'Scrapes live Etsy trends and niches, scores opportunities, and feeds ranked research downstream. Realized sales sharpen its scoring.' },
    { id: 'forge', name: 'Forge', role: 'Design Generation', x: 45, y: 60, statusKey: 'Forge',
      does: 'Turns a niche brief into product concepts and AI-generated images, scores them, and saves the winners for review.' },
    { id: 'archives', name: 'Archives', role: 'Publishing & QA', x: 63, y: 60, statusKey: 'Archives',
      does: 'Quality-checks finished designs and publishes them to Etsy / Printify, tracking what shipped.' },
    { id: 'herald', name: 'Herald', role: 'Promotion', x: 82, y: 52, statusKey: 'Herald',
      does: 'Promotes published products on Pinterest to drive traffic back to the listings.' },
    { id: 'treasury', name: 'Treasury', role: 'Cost & Spend', x: 50, y: 88, statusKey: 'Treasury',
      does: 'Tracks spend per agent and per day. If the daily limit is hit it signals ELLIE to pause the whole crew.' },
  ],
  edges: [
    { from: 'strategist', to: 'nova', kind: 'steer' },
    { from: 'nova', to: 'forge', kind: 'flow' },
    { from: 'forge', to: 'archives', kind: 'flow' },
    { from: 'archives', to: 'herald', kind: 'flow' },
    { from: 'treasury', to: 'nova', kind: 'monitor' },
    { from: 'treasury', to: 'forge', kind: 'monitor' },
    { from: 'treasury', to: 'archives', kind: 'monitor' },
    { from: 'ellie', to: 'strategist', kind: 'steer' },
    { from: 'archives', to: 'nova', kind: 'feedback' }, // realized sales → scoring
    { from: 'archives', to: 'forge', kind: 'feedback' },
  ],
  pipeline: ['Nova', 'Forge', 'Archives', 'Herald'],
}

// ── Trading Floor ────────────────────────────────────────────────────────────
// Flow: analysts (parallel) → bull vs bear debate → research manager judges →
// trader → risk trio → ELLIE (portfolio manager) decides. Scout discovers
// tickers that enter at the top; Fund manager holds the book.
export const TRADING_CREW = {
  id: 'trading',
  label: 'Trading Floor',
  accent: 'var(--bp-accent)',
  agents: [
    { id: 'scout', name: 'Scout', role: 'Discovery', x: 7, y: 50, statusKey: 'scout',
      does: 'Autonomously scans the market for candidates worth analyzing and feeds tickers into the desk.' },
    { id: 'market', name: 'Marcus', role: 'Market Analyst', x: 24, y: 14, statusKey: 'market',
      does: 'Reads price history and technical indicators to frame the setup.' },
    { id: 'social', name: 'Sam', role: 'Sentiment Analyst', x: 24, y: 38, statusKey: 'social',
      does: 'Reads Reddit / StockTwits chatter to gauge the mood around the name.' },
    { id: 'news', name: 'Nova', role: 'News Analyst', x: 24, y: 62, statusKey: 'news',
      does: 'Scans headlines and press for catalysts and risks.' },
    { id: 'fundamentals', name: 'Fiona', role: 'Fundamentals', x: 24, y: 86, statusKey: 'fundamentals',
      does: 'Pulls filings and earnings to judge the underlying business.' },
    { id: 'bull_researcher', name: 'Bruno', role: 'Bull Researcher', x: 43, y: 33, statusKey: 'bull_researcher',
      does: "Builds the strongest case to buy from the analysts' reports." },
    { id: 'bear_researcher', name: 'Bea', role: 'Bear Researcher', x: 43, y: 67, statusKey: 'bear_researcher',
      does: 'Builds the strongest case against, stress-testing the bull thesis.' },
    { id: 'research_manager', name: 'Rex', role: 'Research Manager', x: 57, y: 50, statusKey: 'research_manager',
      does: 'Judges the bull/bear debate and issues a research decision.' },
    { id: 'trader', name: 'Tara', role: 'Trader', x: 69, y: 50, statusKey: 'trader',
      does: 'Turns the research decision into a concrete trade plan.' },
    { id: 'aggressive', name: 'Axel', role: 'Risk · Aggressive', x: 81, y: 24, statusKey: 'aggressive',
      does: 'Argues for maximum justified exposure on the trade plan.' },
    { id: 'conservative', name: 'Cara', role: 'Risk · Conservative', x: 81, y: 50, statusKey: 'conservative',
      does: 'Argues the downside and tighter sizing.' },
    { id: 'neutral', name: 'Niko', role: 'Risk · Neutral', x: 81, y: 76, statusKey: 'neutral',
      does: 'Balances the aggressive and conservative views.' },
    { id: 'portfolio_manager', name: 'ELLIE', role: 'Portfolio Manager', isEllie: true, x: 94, y: 38, statusKey: 'portfolio_manager',
      does: 'Weighs the risk debate and makes the final call — and sizes it against the fund.' },
    { id: 'fund', name: 'Fund', role: 'Fund Manager', x: 94, y: 72, statusKey: 'fund',
      does: 'Holds the book: positions, P&L, and how much capital each decision gets.' },
  ],
  edges: [
    { from: 'scout', to: 'market', kind: 'steer' },
    { from: 'market', to: 'bull_researcher', kind: 'flow' },
    { from: 'social', to: 'bull_researcher', kind: 'flow' },
    { from: 'news', to: 'bear_researcher', kind: 'flow' },
    { from: 'fundamentals', to: 'bear_researcher', kind: 'flow' },
    { from: 'bull_researcher', to: 'bear_researcher', kind: 'debate' },
    { from: 'bull_researcher', to: 'research_manager', kind: 'flow' },
    { from: 'bear_researcher', to: 'research_manager', kind: 'flow' },
    { from: 'research_manager', to: 'trader', kind: 'flow' },
    { from: 'trader', to: 'aggressive', kind: 'flow' },
    { from: 'trader', to: 'conservative', kind: 'flow' },
    { from: 'trader', to: 'neutral', kind: 'flow' },
    { from: 'aggressive', to: 'portfolio_manager', kind: 'flow' },
    { from: 'conservative', to: 'portfolio_manager', kind: 'flow' },
    { from: 'neutral', to: 'portfolio_manager', kind: 'flow' },
    { from: 'portfolio_manager', to: 'fund', kind: 'flow' },
    { from: 'fund', to: 'portfolio_manager', kind: 'monitor' },
  ],
}

export const CREWS = { business: BUSINESS_CREW, trading: TRADING_CREW }

export function getCrew(id) {
  return CREWS[id] ?? null
}

// Map of agent id → agent, for quick lookup.
export function agentIndex(crew) {
  return Object.fromEntries(crew.agents.map(a => [a.id, a]))
}
