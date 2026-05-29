import { useState, useRef, useEffect, useCallback } from 'react'
import { useEllieStore } from '../../store'
import { personalApi, ellieApi } from '../../lib/api'
import soundEngine from '../../lib/soundEngine'

const mono = "var(--font-mono)"
const orb  = "var(--font-ui)"
const raj  = "var(--font-ui)"

const CHAT_BAR_H = 58

// ── Widget pulse keyword map ─────────────────────────────────────────────────
const PULSE_MAP = [
  { words: ['market','stock','spy','nasdaq','aapl','nvda','tsla','amzn','equity','dow','s&p','shares','index'], widget: 'stocks' },
  { words: ['crypto','bitcoin','btc','eth','ethereum','solana','defi','coin','blockchain'], widget: 'crypto' },
  { words: ['weather','storm','temperature','rain','snow','forecast','hurricane','flood'], widget: 'weather' },
  { words: ['nba','nfl','mlb','nhl','basketball','football','playoff','sport','score','game'], widget: 'sports' },
  { words: ['news','breaking','geopolitical','conflict','war','election','headline','intelligence'], widget: 'world-news' },
  { words: ['calendar','schedule','meeting','event','appointment'], widget: 'calendar' },
  { words: ['reminder','remind','task','todo','due'], widget: 'reminders' },
  { words: ['goal','objective','target','milestone','progress','achieve'], widget: 'goals' },
  { words: ['threat','security','cyber','danger','risk','attack','breach'], widget: 'threat-monitor' },
  { words: ['pray','prayer','faith','god','scripture','worship','church','answered prayer'], widget: 'prayer' },
  { words: ['satellite','imagery','map','geographic','terrain','location','coordinates'], widget: 'satellite' },
]

function triggerPulses(text, pulseWidget) {
  const lower = text.toLowerCase()
  const fired = new Set()
  for (const { words, widget } of PULSE_MAP) {
    if (!fired.has(widget) && words.some(w => lower.includes(w))) {
      fired.add(widget)
      pulseWidget(widget)
    }
  }
}

// ── Simple date string parser ────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return undefined
  const s = str.trim().toLowerCase()
  const today = new Date()
  if (s === 'today')    return today.toISOString().split('T')[0]
  if (s === 'tomorrow') { today.setDate(today.getDate() + 1); return today.toISOString().split('T')[0] }
  const d = new Date(str)
  if (!isNaN(d)) return d.toISOString().split('T')[0]
  return undefined
}

// ── Action command parser ────────────────────────────────────────────────────
async function detectAndExecute(text, store) {
  const t = text.trim()
  let actionNote = null  // injected context for ELLIE

  // Morning brief
  if (/^(morning brief|brief me|daily brief|status report|good morning|what'?s my day)/i.test(t)) {
    try {
      const res = await ellieApi.getBrief('personal-brief', {
        calendar: store.calendarEvents?.slice(0,5),
        reminders: store.reminders?.filter(r => !r.completed).slice(0,5),
        goals: store.goals?.filter(g => !g.completed).slice(0,5),
      })
      return { type: 'brief', response: res.data?.brief ?? res.data?.response }
    } catch { /* fall through to normal chat */ }
  }

  // Add reminder: "remind me to X [on/by date]" or "add reminder X"
  const reminderMatch = t.match(/^(?:remind me to|add reminder|set reminder|reminder:?)\s+(.+?)(?:\s+(?:on|by|at)\s+(.+))?$/i)
  if (reminderMatch) {
    const title    = reminderMatch[1].trim()
    const dateStr  = reminderMatch[2]
    const due_date = parseDate(dateStr)
    try {
      const res = await personalApi.createReminder({ title, due_date, priority: 'medium' })
      store.setReminders([...(store.reminders || []), res.data])
      store.pulseWidget('reminders')
      actionNote = `User asked to create a reminder. You successfully added it: "${title}"${due_date ? ` due ${due_date}` : ''}. Confirm this in your response naturally, then continue.`
    } catch (e) {
      actionNote = `User tried to add a reminder "${title}" but it failed. Acknowledge that.`
    }
  }

  // Add calendar event: "add to calendar X on [date]" or "schedule X"
  const calMatch = t.match(/^(?:add to calendar|schedule|put on calendar|add event|calendar event:?)\s+(.+?)(?:\s+(?:on|at)\s+(.+))?$/i)
  if (calMatch) {
    const title    = calMatch[1].trim()
    const dateStr  = calMatch[2]
    const start    = dateStr ? new Date(dateStr) : new Date()
    if (isNaN(start)) start.setHours(9, 0, 0, 0)
    try {
      const res = await personalApi.createEvent({
        title,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + 3600000).toISOString(),
      })
      store.setCalendarEvents([...(store.calendarEvents || []), res.data])
      store.pulseWidget('calendar')
      actionNote = `User asked to add a calendar event. Successfully added: "${title}"${dateStr ? ` on ${dateStr}` : ''}. Confirm naturally.`
    } catch {
      actionNote = `User tried to add a calendar event "${title}" but it failed. Acknowledge that.`
    }
  }

  // Make a note
  const noteMatch = t.match(/^(?:make a note|note this|take a note|note:?)\s*:?\s*(.+)/i)
  if (noteMatch) {
    const content = noteMatch[1].trim()
    const title   = content.slice(0, 50) + (content.length > 50 ? '…' : '')
    try {
      const res = await personalApi.createNote({ title, content })
      store.setNotes([res.data, ...(store.notes || [])])
      store.pulseWidget('notes')
      actionNote = `User asked to take a note. Successfully saved: "${title}". Confirm naturally.`
    } catch {
      actionNote = `User tried to make a note but it failed. Acknowledge that.`
    }
  }

  return { type: 'chat', actionNote }
}

// ── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text, speed = 14) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(false); return }
    setDisplayed('')
    setDone(false)
    let i = 0
    ref.current = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(ref.current); setDone(true) }
    }, speed)
    return () => clearInterval(ref.current)
  }, [text, speed])

  return { displayed, done }
}

// ── Bold formatter ────────────────────────────────────────────────────────────
function formatEllie(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--violet-500);letter-spacing:.5px">$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

// ── Proactive alert check ────────────────────────────────────────────────────
async function runProactiveCheck(store) {
  const { reminders, goals, addChatMessage, setChatOpen, pulseWidget } = store
  const alerts = []

  // Overdue reminders
  const today = new Date().toISOString().split('T')[0]
  const overdue = (reminders || []).filter(r =>
    !r.completed && r.due_date && r.due_date < today
  )
  if (overdue.length) {
    alerts.push(`**⚠ OVERDUE:** ${overdue.length} reminder${overdue.length > 1 ? 's' : ''} past due: ${overdue.slice(0, 3).map(r => `"${r.title}"`).join(', ')}`)
    pulseWidget('reminders')
  }

  // Goals with no progress and near target
  const stalled = (goals || []).filter(g =>
    !g.completed && g.status === 'active' && (g.progress || 0) === 0 &&
    g.target_date && g.target_date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  )
  if (stalled.length) {
    alerts.push(`**📍 STALLED GOAL:** "${stalled[0].title}" has 0% progress and deadline approaching.`)
    pulseWidget('goals')
  }

  if (alerts.length === 0) return

  soundEngine.alert()
  store.setEllieAvatarState('alert')
  setTimeout(() => store.setEllieAvatarState('speaking'), 800)
  setTimeout(() => store.setEllieAvatarState('idle'), 5000)
  const alertMsg = alerts.join('\n\n') + '\n\n— ELLIE'
  addChatMessage({ role: 'assistant', content: alertMsg })
  setChatOpen(true)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EllieChat() {
  const store = useEllieStore()
  const {
    chatMessages, chatOpen, chatLoading, addChatMessage,
    setChatOpen, setChatLoading, pulseWidget,
    calendarEvents, reminders, goals,
    setEllieAvatarState,
  } = store

  const [input, setInput]       = useState('')
  const [panelVisible, setPanelVisible] = useState(false)
  const [historyOpen, setHistoryOpen]   = useState(false)
  const inputRef  = useRef()
  const panelRef  = useRef()

  // Proactive alerts — run once on mount, then every 10 minutes
  useEffect(() => {
    const run = () => runProactiveCheck(store)
    // Delay initial check so data has time to load
    const init = setTimeout(run, 8000)
    const interval = setInterval(run, 10 * 60 * 1000)
    return () => { clearTimeout(init); clearInterval(interval) }
  }, [reminders, goals]) // re-arm when personal data loads

  // The most recent assistant response for typewriter
  const latestResponse = [...chatMessages].reverse().find(m => m.role === 'assistant')?.content ?? ''
  const { displayed, done } = useTypewriter(chatLoading ? '' : (chatOpen ? latestResponse : ''), 13)

  // Show/hide panel + avatar listening state
  useEffect(() => {
    if (chatOpen) {
      setPanelVisible(true)
      setEllieAvatarState('listening')
    } else {
      setEllieAvatarState('idle')
    }
  }, [chatOpen])

  const closePanel = useCallback(() => {
    setChatOpen(false)
    setEllieAvatarState('idle')
    setTimeout(() => setPanelVisible(false), 300)
  }, [setChatOpen, setEllieAvatarState])

  // Focus input when panel opens
  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || chatLoading) return
    soundEngine.send()
    setInput('')
    addChatMessage({ role: 'user', content: text })
    setChatOpen(true)
    setChatLoading(true)
    setEllieAvatarState('thinking')

    try {
      // 1. Detect action commands
      const action = await detectAndExecute(text, store)

      // 2. If it returned a direct brief response, use it
      if (action.type === 'brief' && action.response) {
        addChatMessage({ role: 'assistant', content: action.response })
        triggerPulses(action.response, pulseWidget)
        setChatLoading(false)
        setEllieAvatarState('speaking')
        setTimeout(() => setEllieAvatarState('listening'), 3000)
        return
      }

      // 3. Build message list (last 10 msgs + current)
      const history = chatMessages.slice(-9).map(m => ({ role: m.role, content: m.content }))
      const userContent = action.actionNote
        ? `${text}\n\n[System: ${action.actionNote}]`
        : text
      history.push({ role: 'user', content: userContent })

      // 4. Call ELLIE chat with live personal context
      const res = await ellieApi.chat(history, {
        calendar_today: calendarEvents?.slice(0, 5),
        pending_reminders: reminders?.filter(r => !r.completed).slice(0, 5),
        active_goals: goals?.filter(g => !g.completed).slice(0, 5),
      })

      const reply = res.data?.response ?? res.data?.brief ?? 'Feed interrupted. — ELLIE'
      addChatMessage({ role: 'assistant', content: reply })
      soundEngine.receive()
      triggerPulses(reply, pulseWidget)
      setEllieAvatarState('speaking')
      // Speaking lasts ~1s per 60 chars of response then back to listening
      const speakDur = Math.min(Math.max(reply.length * 16, 2000), 8000)
      setTimeout(() => setEllieAvatarState('listening'), speakDur)
    } catch (err) {
      addChatMessage({ role: 'assistant', content: 'Connection interrupted. Check backend status. — ELLIE' })
      setEllieAvatarState('listening')
    } finally {
      setChatLoading(false)
    }
  }, [input, chatLoading, chatMessages, store, addChatMessage, setChatOpen, setChatLoading, pulseWidget, calendarEvents, reminders, goals, setEllieAvatarState])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Previous exchanges (all but latest response, up to last 3 exchanges = 6 msgs)
  const history = chatMessages.slice(-7, -1)

  return (
    <>
      {/* ── Response panel ── */}
      {panelVisible && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: CHAT_BAR_H,
            left: 0, right: 0,
            zIndex: 1200,
            maxHeight: '52vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--paper-50)',
            borderTop: '2px solid var(--violet-500)',
            borderBottom: '1px solid var(--paper-200)',
            animation: `${chatOpen ? 'ellie-panel-in' : 'ellie-panel-out'} 0.28s ease forwards`,
            pointerEvents: chatOpen ? 'auto' : 'none',
          }}
        >
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: '1px solid var(--paper-200)',
            flexShrink: 0,
            background: 'var(--paper-100)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                background: 'rgba(155,114,255,0.12)',
                border: '1.5px solid rgba(155,114,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <img src="/sprites/EllieSprite/EllieHeadshot.png" width={22} height={22} alt="ELLIE"
                  style={{ objectFit: 'cover', borderRadius: 3, display: 'block' }} />
              </div>
              <span style={{ fontFamily: orb, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--ink-700)' }}>ELLIE RESPONSE</span>
              {chatLoading && (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%', background: 'var(--violet-500)',
                      animation: `pulse-dot 1.2s ease-in-out ${i*0.2}s infinite`,
                    }}/>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {history.length > 0 && (
                <button
                  onClick={() => setHistoryOpen(h => !h)}
                  style={{
                    background: historyOpen ? 'var(--paper-200)' : 'none',
                    border: '1px solid var(--ink-300)',
                    color: 'var(--ink-500)', cursor: 'pointer',
                    fontFamily: mono, fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-md)',
                    letterSpacing: 1,
                  }}
                >HISTORY {historyOpen ? '▾' : '▸'}</button>
              )}
              <button
                onClick={closePanel}
                style={{
                  background: 'none', border: '1px solid var(--ink-300)',
                  color: 'var(--ink-500)', cursor: 'pointer',
                  fontFamily: mono, fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-md)',
                }}
              >✕</button>
            </div>
          </div>

          {/* Chat history (collapsible) */}
          {historyOpen && history.length > 0 && (
            <div style={{
              overflowY: 'auto', padding: '8px 16px',
              borderBottom: '1px solid var(--paper-200)',
              maxHeight: 160, flexShrink: 0,
            }}>
              {history.map((m, i) => (
                <div key={i} style={{
                  marginBottom: 8,
                  opacity: 0.7,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontFamily: mono, fontSize: 9, color: m.role === 'user' ? 'var(--amber-500)' : 'var(--violet-500)',
                    letterSpacing: 1, marginTop: 2, flexShrink: 0, fontWeight: 700,
                  }}>{m.role === 'user' ? 'DREW' : 'ELLIE'}</span>
                  <span style={{ fontFamily: raj, fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>
                    {m.content.replace(/\[System:.*?\]/g, '').trim()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Current response with typewriter */}
          <div style={{ overflowY: 'auto', padding: '14px 16px', flex: 1 }}>
            {chatLoading ? (
              <div style={{
                fontFamily: mono, fontSize: 11, color: 'var(--ink-500)',
                letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>PROCESSING</span>
                <span style={{ animation: 'cursor-blink 0.7s step-end infinite', color: 'var(--violet-500)' }}>_</span>
              </div>
            ) : (
              <div style={{ fontFamily: raj, fontSize: 14, lineHeight: 1.75, color: 'var(--ink-700)' }}>
                <span dangerouslySetInnerHTML={{ __html: formatEllie(displayed) }} />
                {!done && <span className="ellie-cursor" />}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: CHAT_BAR_H,
        zIndex: 1300,
        background: 'var(--paper-50)',
        borderTop: '1.5px solid var(--ink-300)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        backdropFilter: 'blur(8px)',
      }}>

        {/* ELLIE avatar */}
        <div style={{
          width: 36, height: 36, flexShrink: 0,
          background: 'rgba(3,1,20,0.92)',
          border: `1.5px solid ${chatLoading ? 'rgba(155,114,255,0.85)' : 'rgba(155,114,255,0.35)'}`,
          borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: chatLoading ? '0 0 18px rgba(155,114,255,0.55), inset 0 0 12px rgba(155,114,255,0.1)' : '0 0 8px rgba(155,114,255,0.18)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}>
          <img src="/sprites/EllieSprite/EllieHeadshot.png" width={28} height={28} alt="ELLIE"
            style={{ objectFit: 'cover', borderRadius: 4, display: 'block' }} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="TALK TO ELLIE..."
          style={{
            flex: 1,
            background: 'var(--paper-100)',
            border: '1.5px solid var(--ink-300)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--ink-900)',
            fontFamily: raj,
            fontSize: 14,
            padding: '0 14px',
            height: 38,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--violet-500)'}
          onBlur={e  => e.target.style.borderColor = 'var(--ink-300)'}
          disabled={chatLoading}
        />

        {/* Mic button (UI only) */}
        <button
          title="Voice input (coming soon)"
          style={{
            width: 36, height: 36, flexShrink: 0,
            background: 'none',
            border: '1.5px solid var(--ink-300)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--ink-500)',
            cursor: 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}
        >🎙</button>

        {/* Send button */}
        <button
          onClick={send}
          disabled={chatLoading || !input.trim()}
          style={{
            height: 36, padding: '0 16px', flexShrink: 0,
            background: input.trim() && !chatLoading ? 'var(--grad-sunrise)' : 'var(--paper-200)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: input.trim() && !chatLoading ? '#fff' : 'var(--ink-500)',
            fontFamily: orb, fontWeight: 700, fontSize: 12, letterSpacing: 1,
            cursor: input.trim() && !chatLoading ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >SEND</button>
      </div>
    </>
  )
}
