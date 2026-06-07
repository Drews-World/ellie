import { useEffect, useCallback, useState } from 'react'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

const LEAGUES     = ['nba', 'nfl', 'mlb']
const LEAGUE_LABELS = { nba: 'NBA', nfl: 'NFL', mlb: 'MLB' }
const REFRESH_MS  = 60 * 60 * 1000   // 1 hour
const PREVIEW     = 3        // games shown before "show more"

export default function SportsWidget() {
  const { sports, setSports } = useEllieStore()
  // per-league expanded state
  const [expanded, setExpanded] = useState({})

  const fetchSports = useCallback(() => {
    worldApi.getSports().then(r => setSports(r.data || {})).catch(() => {})
  }, [setSports])

  useEffect(() => {
    fetchSports()
    const id = setInterval(fetchSports, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchSports])

  const toggle = (league) => setExpanded(p => ({ ...p, [league]: !p[league] }))

  return (
    <Widget title="SPORTS INTEL" badge="LIVE SCORES" badgeType="amber" widgetKey="sports" detailTitle="SPORTS // ELLIE BRIEF">
      {/* scrollable container */}
      <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
        {LEAGUES.map(league => {
          const leagueData = sports[league]
          const allEvents  = leagueData?.events || []
          const isExpanded = expanded[league]
          const shown      = isExpanded ? allEvents : allEvents.slice(0, PREVIEW)
          const extra      = allEvents.length - PREVIEW

          return (
            <div key={league} style={{ marginBottom: 10 }}>
              {/* League header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: orb, fontSize: 8, letterSpacing: 2, color: '#5FD0D8', marginBottom: 5,
              }}>
                <span>{LEAGUE_LABELS[league]}</span>
                {allEvents.length > 0 && (
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(95,208,216,0.5)' }}>
                    {allEvents.length} GAME{allEvents.length !== 1 ? 'S' : ''}
                  </span>
                )}
              </div>

              {allEvents.length === 0 ? (
                <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)' }}>NO ACTIVE GAMES</div>
              ) : (
                <>
                  {shown.map((ev, i) => {
                    const comps  = ev.competitions?.[0]?.competitors || []
                    const home   = comps.find(c => c.homeAway === 'home')
                    const away   = comps.find(c => c.homeAway === 'away')
                    const status = ev.status?.type?.shortDetail || ''
                    const live   = ev.status?.type?.state === 'in'
                    return (
                      <div key={i} style={{
                        padding: '5px 0', borderBottom: '1px solid rgba(95,208,216,0.05)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 10, color: '#cceeff' }}>
                            {away?.team?.abbreviation ?? '?'} @ {home?.team?.abbreviation ?? '?'}
                          </span>
                          {status && (
                            <span style={{ fontFamily: mono, fontSize: 8, color: live ? '#00ff9d' : 'rgba(180,220,255,0.35)' }}>
                              {live && '● '}{status}
                            </span>
                          )}
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 10, color: live ? '#00ff9d' : '#ffb300', fontWeight: live ? 700 : 400 }}>
                          {away?.score != null && home?.score != null ? `${away.score}–${home.score}` : '—'}
                        </span>
                      </div>
                    )
                  })}

                  {/* Show more / less toggle */}
                  {extra > 0 && (
                    <button
                      onClick={() => toggle(league)}
                      style={{
                        marginTop: 4, background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: mono, fontSize: 8, letterSpacing: 1,
                        color: 'rgba(95,208,216,0.6)',
                        padding: '3px 0',
                      }}
                    >
                      {isExpanded ? '▲ SHOW LESS' : `▼ +${extra} MORE GAME${extra !== 1 ? 'S' : ''}`}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </Widget>
  )
}
