/**
 * Metrônomo com Web Audio, capaz de tocar junto a batida ou o dedilhado
 * escolhido — cada tipo de golpe com um timbre próprio.
 *
 * O agendamento usa o relógio do AudioContext (não setInterval), que é o único
 * jeito de manter o pulso estável: um temporizador de JS derrapa em dezenas de
 * milissegundos e isso é audível.
 */

import type { Rhythm } from '../data/rhythms'

export type StepKind = 'D' | 'U' | 'X' | 'P' | 'A' | 'rest' | 'pluck'

export interface Step {
  kind: StepKind
  /** cordas tocadas, 6 = mais grave (só para dedilhado) */
  strings?: number[]
}

/** Frequência das cordas soltas do violão, da 6ª para a 1ª. */
const STRING_HZ: Record<number, number> = { 6: 82.41, 5: 110.0, 4: 146.83, 3: 196.0, 2: 246.94, 1: 329.63 }

/** Converte a batida ou o dedilhado numa sequência de passos por semicolcheia. */
export function rhythmSteps(r: Rhythm): Step[] {
  if (r.kind === 'batida') {
    return r.pattern.split('').map((ch): Step => {
      if (ch === 'D' || ch === 'U' || ch === 'X' || ch === 'P' || ch === 'A') return { kind: ch }
      return { kind: 'rest' }
    })
  }
  return r.pattern
    .split(/\s+/)
    .filter(Boolean)
    .map((token): Step => {
      const [strings] = token.split(':')
      return { kind: 'pluck', strings: strings.split('').map(Number).filter((n) => n >= 1 && n <= 6) }
    })
}

export interface MetronomeOptions {
  bpm: number
  /** passos por tempo (4 = semicolcheias) */
  subdivision: number
  steps: Step[]
  /** tocar os golpes da batida além do clique */
  playPattern: boolean
  /** clique do metrônomo ligado */
  playClick: boolean
  onStep?: (index: number) => void
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_S = 0.12

export class Metronome {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private timer: number | null = null
  private raf = 0
  private nextStepTime = 0
  private stepIndex = 0
  private queue: { index: number; time: number }[] = []
  private opts: MetronomeOptions
  running = false

  constructor(opts: MetronomeOptions) {
    this.opts = opts
  }

  update(patch: Partial<MetronomeOptions>) {
    this.opts = { ...this.opts, ...patch }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      const len = Math.floor(this.ctx.sampleRate * 0.4)
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.noise = buf
    }
    return this.ctx
  }

  async start() {
    const ctx = this.ensureContext()
    if (ctx.state === 'suspended') await ctx.resume()
    if (this.running) return
    this.running = true
    this.stepIndex = 0
    this.nextStepTime = ctx.currentTime + 0.08
    this.queue = []
    this.timer = window.setInterval(() => this.scheduler(), LOOKAHEAD_MS)
    this.watch()
  }

  stop() {
    this.running = false
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    cancelAnimationFrame(this.raf)
    this.queue = []
    this.opts.onStep?.(-1)
  }

  dispose() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
  }

  private stepDuration(): number {
    return 60 / this.opts.bpm / this.opts.subdivision
  }

  private scheduler() {
    const ctx = this.ctx
    if (!ctx) return
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.scheduleStep(this.stepIndex, this.nextStepTime)
      this.queue.push({ index: this.stepIndex, time: this.nextStepTime })
      this.nextStepTime += this.stepDuration()
      this.stepIndex = (this.stepIndex + 1) % Math.max(1, this.opts.steps.length)
    }
  }

  /** Sincroniza o destaque visual com o que já está agendado no áudio. */
  private watch = () => {
    const ctx = this.ctx
    if (!ctx || !this.running) return
    while (this.queue.length && this.queue[0].time <= ctx.currentTime) {
      const item = this.queue.shift()!
      this.opts.onStep?.(item.index)
    }
    this.raf = requestAnimationFrame(this.watch)
  }

  private scheduleStep(index: number, time: number) {
    const { subdivision, steps, playClick, playPattern } = this.opts
    if (playClick && index % subdivision === 0) {
      const isDownbeat = index === 0
      this.click(time, isDownbeat ? 1760 : 1200, isDownbeat ? 0.28 : 0.16)
    }
    if (!playPattern) return
    const step = steps[index]
    if (!step || step.kind === 'rest') return
    switch (step.kind) {
      case 'D': this.strum(time, 'down'); break
      case 'U': this.strum(time, 'up'); break
      case 'A': this.strum(time, 'chord'); break
      case 'X': this.strum(time, 'mute'); break
      case 'P': this.thumb(time); break
      case 'pluck': step.strings?.forEach((s, i) => this.pluck(time + i * 0.012, s)); break
    }
  }

  // ---------- timbres ----------

  private click(time: number, freq: number, gain: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(gain, time + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)
    osc.connect(g).connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.05)
  }

  /**
   * Golpes de mão direita. A diferença entre baixo e cima é real: a descida
   * pega as cordas graves primeiro e soa mais cheia; a subida pega as agudas.
   */
  private strum(time: number, type: 'down' | 'up' | 'mute' | 'chord') {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()

    let dur = 0.14
    let peak = 0.3
    if (type === 'down') {
      filter.type = 'lowpass'
      filter.frequency.value = 2600
      filter.Q.value = 0.7
    } else if (type === 'up') {
      filter.type = 'highpass'
      filter.frequency.value = 1400
      dur = 0.09
      peak = 0.22
    } else if (type === 'chord') {
      filter.type = 'lowpass'
      filter.frequency.value = 3200
      peak = 0.26
    } else {
      filter.type = 'bandpass'
      filter.frequency.value = 2200
      filter.Q.value = 1.2
      dur = 0.05
      peak = 0.2
    }

    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(peak, time + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    src.connect(filter).connect(g).connect(ctx.destination)
    src.start(time)
    src.stop(time + dur + 0.02)
  }

  private thumb(time: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(110, time)
    osc.frequency.exponentialRampToValueAtTime(78, time + 0.12)
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.34, time + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22)
    osc.connect(g).connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.24)
  }

  private pluck(time: number, stringNumber: number) {
    const ctx = this.ctx!
    const freq = STRING_HZ[stringNumber] ?? 196
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = stringNumber >= 5 ? 'triangle' : 'sawtooth'
    osc.frequency.value = freq
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freq * 6
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.2, time + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32)
    osc.connect(filter).connect(g).connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.34)
  }
}
