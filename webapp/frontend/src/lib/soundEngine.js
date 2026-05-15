/**
 * ELLIE Sound Engine
 * Synthwave cyberpunk ambient music + UI sound effects
 * Pure Web Audio API — no external files required
 */

// ── Note frequency table ──────────────────────────────────────────────────────
const F = {
  C1:32.70, G1:49.00, Ab1:51.91, Bb1:58.27,
  C2:65.41, D2:73.42, Eb2:77.78, F2:87.31, G2:98.00, Ab2:103.83, Bb2:116.54,
  C3:130.81, D3:146.83, Eb3:155.56, F3:174.61, G3:196.00, Ab3:207.65, Bb3:233.08,
  C4:261.63, D4:293.66, Eb4:311.13, F4:349.23, G4:392.00, Ab4:415.30, Bb4:466.16,
  C5:523.25, D5:587.33, Eb5:622.25, F5:698.46, G5:783.99, Ab5:830.61, Bb5:932.33,
  C6:1046.5,
}

// ── Synthwave patterns (4 bars × 8 eighth-note steps) ──────────────────────
const BPM          = 80
const STEP_SEC     = (60 / BPM) / 2    // eighth-note = 0.375s
const STEPS_PER_BAR = 8
const TOTAL_STEPS  = 32                // 4 bars

// Bass: quarter notes (step index → freq). 16 entries (steps 0,2,4,6 of each bar × 4 bars)
const BASS_PATTERN = [
  F.C2,  F.G2,  F.Ab2, F.Eb2,
  F.C2,  F.G2,  F.F2,  F.G2,
  F.C2,  F.G2,  F.Ab2, F.Eb2,
  F.Ab2, F.Eb2, F.F2,  F.G2,
]

// Pad chords (one chord per half-bar = every 4 steps)
const PAD_CHORDS = [
  [F.C3, F.Eb3, F.G3],        // Cm
  [F.Ab2, F.C3, F.Eb3],       // Ab
  [F.Eb3, F.G3, F.Bb3],       // Eb
  [F.F3, F.Ab3, F.C4],        // Fm
  [F.C3, F.Eb3, F.G3],        // Cm
  [F.G2, F.D3, F.G3],         // G5
  [F.Ab2, F.C3, F.Eb3],       // Ab
  [F.F2, F.C3, F.F3],         // Fm
]

// Arp: 8th notes, 4 patterns cycling with chord
const ARP_PATTERNS = [
  [F.C5, F.Eb5, F.G5, F.Bb5, F.G5, F.Eb5, F.C5, F.Eb5],   // Cm up/down
  [F.Ab4, F.C5, F.Eb5, F.C5, F.Ab4, F.C5, F.Eb5, F.Ab4],   // Ab
  [F.Eb5, F.G5, F.Bb5, F.G5, F.Eb5, F.G5, F.Bb5, F.Eb5],   // Eb
  [F.F4,  F.Ab4,F.C5, F.Eb5, F.C5, F.Ab4, F.F4, F.Ab4],    // Fm
  [F.C5, F.Eb5, F.G5, F.Bb5, F.G5, F.Eb5, F.C5, F.Eb5],
  [F.G4,  F.D5, F.G5, F.D5, F.G4, F.D5, F.G5, F.D5],
  [F.Ab4, F.C5, F.Eb5, F.C5, F.Ab4, F.C5, F.Eb5, F.Ab4],
  [F.F4,  F.C5, F.F5, F.C5, F.Ab4, F.C5, F.F4, F.Ab4],
]

// ── SoundEngine class ─────────────────────────────────────────────────────────
class SoundEngine {
  constructor() {
    this.ctx         = null
    this.master      = null
    this.musicBus    = null
    this.sfxBus      = null
    this.reverb      = null

    this._playing    = false
    this._muted      = false
    this._volume     = 0.55
    this._musicVol   = 0.45
    this._sfxVol     = 0.7

    this._step       = 0
    this._nextTime   = 0
    this._timer      = null
    this._initialized= false

    // external listener
    this.onStateChange = null   // (isPlaying) => {}
  }

  // ── Lazy init (must be called on first user gesture) ──────────────────────
  _init() {
    if (this._initialized) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }

    this.ctx = new (window.AudioContext || window.webkitAudioContext)()

    // Master → destination
    this.master = this.ctx.createGain()
    this.master.gain.value = this._muted ? 0 : this._volume
    this.master.connect(this.ctx.destination)

    // Music bus → reverb send → master
    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = 0       // starts at 0, fades in
    this.musicBus.connect(this.master)
    this.reverb = this._makeReverb(3.5)
    const revSend = this.ctx.createGain()
    revSend.gain.value = 0.3
    this.musicBus.connect(revSend)
    revSend.connect(this.reverb)
    this.reverb.connect(this.master)

    // SFX bus
    this.sfxBus = this.ctx.createGain()
    this.sfxBus.gain.value = this._sfxVol
    this.sfxBus.connect(this.master)

    this._initialized = true
  }

  _makeReverb(sec) {
    const sr  = this.ctx.sampleRate
    const len = Math.ceil(sr * sec)
    const buf = this.ctx.createBuffer(2, len, sr)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8)
      }
    }
    const conv = this.ctx.createConvolver()
    conv.buffer = buf
    return conv
  }

  // ── Volume / Mute ─────────────────────────────────────────────────────────
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.master && !this._muted)
      this.master.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.05)
  }

  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v))
    if (this.musicBus && this._playing)
      this.musicBus.gain.setTargetAtTime(this._musicVol * 0.7, this.ctx.currentTime, 0.05)
  }

  setMuted(m) {
    this._muted = !!m
    if (this.master)
      this.master.gain.setTargetAtTime(this._muted ? 0 : this._volume, this.ctx.currentTime, 0.05)
  }

  get isPlaying()  { return this._playing }
  get isMuted()    { return this._muted }
  get volume()     { return this._volume }
  get musicVolume(){ return this._musicVol }

  // ── Ambient Music ─────────────────────────────────────────────────────────
  toggleMusic() {
    this._init()
    if (this._playing) this.stopMusic()
    else               this.startMusic()
  }

  startMusic() {
    this._init()
    if (this._playing) return
    this._playing  = true
    this._step     = 0
    this._nextTime = this.ctx.currentTime + 0.15
    // Fade in music bus
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime)
    this.musicBus.gain.setValueAtTime(0, this.ctx.currentTime)
    this.musicBus.gain.linearRampToValueAtTime(this._musicVol * 0.7, this.ctx.currentTime + 3)
    this._tick()
    this.onStateChange?.(true)
  }

  stopMusic() {
    if (!this._playing) return
    this._playing = false
    clearTimeout(this._timer)
    if (this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8)
    }
    this.onStateChange?.(false)
  }

  _tick() {
    if (!this._playing) return
    const LOOKAHEAD  = 0.12   // schedule this far ahead (sec)
    const INTERVAL   = 40     // re-check every 40ms

    while (this._nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this._scheduleStep(this._step, this._nextTime)
      this._nextTime += STEP_SEC
      this._step = (this._step + 1) % TOTAL_STEPS
    }
    this._timer = setTimeout(() => this._tick(), INTERVAL)
  }

  _scheduleStep(step, t) {
    const bar    = Math.floor(step / STEPS_PER_BAR)
    const beat   = step % STEPS_PER_BAR   // 0-7 within the bar

    // ── Bass: every 2 steps (quarter notes) ────────────────────────
    if (beat % 2 === 0) {
      const bassIdx = (bar * 4 + beat / 2) % BASS_PATTERN.length
      this._bass(BASS_PATTERN[bassIdx], t, STEP_SEC * 1.7)
    }

    // ── Pad: every 4 steps (half bar) ──────────────────────────────
    if (beat % 4 === 0) {
      const padIdx = (bar * 2 + Math.floor(beat / 4)) % PAD_CHORDS.length
      PAD_CHORDS[padIdx].forEach(freq => this._pad(freq, t, STEP_SEC * 3.85))
    }

    // ── Arpeggio: every step (8th notes) ───────────────────────────
    const arpRow = Math.floor(step / STEPS_PER_BAR) % ARP_PATTERNS.length
    const arpFreq = ARP_PATTERNS[arpRow][beat]
    if (arpFreq) this._arp(arpFreq, t, STEP_SEC * 0.55)

    // ── Kick: beats 1 & 3 (steps 0 & 4 of each bar) ───────────────
    if (beat === 0 || beat === 4) this._kick(t)

    // ── Snare: beat 2 & 4 (steps 2 & 6 of each bar) ───────────────
    if (beat === 2 || beat === 6) this._snare(t)

    // ── Closed hi-hat: every step ──────────────────────────────────
    this._hihat(t, beat % 2 === 0 ? 0.18 : 0.08)
  }

  // ── Instrument voices ────────────────────────────────────────────────────
  _bass(freq, t, dur) {
    const g   = this.ctx.createGain()
    const osc = this.ctx.createOscillator()
    const flt = this.ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, t)

    flt.type = 'lowpass'
    flt.frequency.setValueAtTime(400, t)
    flt.frequency.linearRampToValueAtTime(180, t + dur)
    flt.Q.value = 3

    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.65, t + 0.02)
    g.gain.setTargetAtTime(0, t + dur * 0.7, 0.08)

    osc.connect(flt)
    flt.connect(g)
    g.connect(this.musicBus)
    osc.start(t)
    osc.stop(t + dur + 0.2)
  }

  _pad(freq, t, dur) {
    // 3 detuned oscillators
    const detunes = [-8, 0, 8]
    const g   = this.ctx.createGain()
    const flt = this.ctx.createBiquadFilter()

    flt.type = 'lowpass'
    flt.frequency.setValueAtTime(600, t)
    flt.frequency.linearRampToValueAtTime(300, t + dur * 0.5)
    flt.Q.value = 1.5

    // LFO on filter cutoff
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 0.25
    lfoGain.gain.value  = 80
    lfo.connect(lfoGain)
    lfoGain.connect(flt.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.3)

    detunes.forEach(det => {
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(freq, t)
      o.detune.value = det
      o.connect(flt)
      o.start(t)
      o.stop(t + dur + 0.3)
    })

    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.4)   // slow attack
    g.gain.setTargetAtTime(0, t + dur * 0.85, 0.3)

    flt.connect(g)
    g.connect(this.musicBus)
  }

  _arp(freq, t, dur) {
    const osc = this.ctx.createOscillator()
    const g   = this.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)

    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.14, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)

    osc.connect(g)
    g.connect(this.musicBus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  _kick(t) {
    const osc = this.ctx.createOscillator()
    const g   = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.18)

    g.gain.setValueAtTime(0.9, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)

    osc.connect(g)
    g.connect(this.musicBus)
    osc.start(t)
    osc.stop(t + 0.3)
  }

  _snare(t) {
    const noise = this._whiteNoise(0.12)
    const g     = this.ctx.createGain()
    const flt   = this.ctx.createBiquadFilter()

    flt.type = 'bandpass'
    flt.frequency.value = 1800
    flt.Q.value = 0.8

    g.gain.setValueAtTime(0.25, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)

    noise.connect(flt)
    flt.connect(g)
    g.connect(this.musicBus)
    noise.start(t)
    noise.stop(t + 0.15)
  }

  _hihat(t, vel) {
    if (vel < 0.05) return
    const noise = this._whiteNoise(0.05)
    const g     = this.ctx.createGain()
    const flt   = this.ctx.createBiquadFilter()

    flt.type = 'highpass'
    flt.frequency.value = 8000

    g.gain.setValueAtTime(vel * 0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)

    noise.connect(flt)
    flt.connect(g)
    g.connect(this.musicBus)
    noise.start(t)
    noise.stop(t + 0.08)
  }

  _whiteNoise(dur) {
    const sr  = this.ctx.sampleRate
    const len = Math.ceil(sr * dur)
    const buf = this.ctx.createBuffer(1, len, sr)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    return src
  }

  // ── Sound Effects ─────────────────────────────────────────────────────────
  // All SFX go through sfxBus; call _init() first

  _sfxTone(freq, type, dur, vol, t0) {
    if (!this._initialized) return
    const now = t0 ?? this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g   = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.connect(g); g.connect(this.sfxBus)
    osc.start(now); osc.stop(now + dur + 0.02)
  }

  // Short UI click
  click() {
    this._init()
    this._sfxTone(900, 'sine', 0.06, 0.35)
  }

  // Button confirm / open
  confirm() {
    this._init()
    const now = this.ctx.currentTime
    this._sfxTone(600, 'sine', 0.07, 0.3, now)
    this._sfxTone(900, 'sine', 0.07, 0.3, now + 0.06)
  }

  // Send ELLIE message
  send() {
    this._init()
    const now = this.ctx.currentTime
    this._sfxTone(800,  'sine', 0.06, 0.28, now)
    this._sfxTone(1200, 'sine', 0.06, 0.22, now + 0.07)
    this._sfxTone(1600, 'sine', 0.06, 0.15, now + 0.13)
  }

  // ELLIE response received
  receive() {
    this._init()
    const now = this.ctx.currentTime
    this._sfxTone(F.G5, 'triangle', 0.09, 0.2, now)
    this._sfxTone(F.Eb5,'triangle', 0.09, 0.18, now + 0.09)
    this._sfxTone(F.C5, 'triangle', 0.12, 0.15, now + 0.18)
  }

  // Proactive / notification alert
  alert() {
    this._init()
    const now = this.ctx.currentTime
    for (let i = 0; i < 3; i++) {
      this._sfxTone(660, 'square', 0.09, 0.18, now + i * 0.18)
    }
  }

  // High-priority police / urgent alert
  policeAlert() {
    this._init()
    const now = this.ctx.currentTime
    // Descending tritone — tense/urgent
    this._sfxTone(880, 'sawtooth', 0.12, 0.25, now)
    this._sfxTone(622, 'sawtooth', 0.12, 0.22, now + 0.14)
    this._sfxTone(440, 'sawtooth', 0.18, 0.20, now + 0.28)
  }

  // Widget pulse (ELLIE highlighting a widget)
  widgetPulse() {
    this._init()
    const now = this.ctx.currentTime
    this._sfxTone(F.C5, 'sine', 0.18, 0.15, now)
    this._sfxTone(F.G5, 'sine', 0.24, 0.10, now + 0.07)
  }

  // Data refresh tick
  dataRefresh() {
    this._init()
    this._sfxTone(1400, 'sine', 0.04, 0.2)
  }

  // Dashboard boot sequence — call on mount
  startup() {
    this._init()
    const now = this.ctx.currentTime
    const notes = [F.C4, F.G4, F.C5, F.Eb5, F.G5]
    notes.forEach((freq, i) => {
      this._sfxTone(freq, 'triangle', 0.14, 0.25 - i * 0.04, now + i * 0.12)
    })
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
const soundEngine = new SoundEngine()
export default soundEngine
