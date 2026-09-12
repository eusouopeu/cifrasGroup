/**
 * Reprodução dos jogos de EQ/pan/delay/compressão: um trecho de música real
 * (`samples.ts`), opcionalmente roteado por uma cadeia de efeito antes da
 * saída — assim cada jogo só descreve a cadeia. Tocar A e depois B corta o
 * anterior, para os dois nunca se sobreporem.
 *
 * Se o arquivo não carregar, cai no loop sintético antigo (tríade em pluck)
 * para a rodada não ficar muda.
 */
import { audioContext, pluckNote } from '../audio/pluck'
import type { ExerciseSample } from './samples'

/** entrada e saída da cadeia; num efeito de um nó só, as duas são o mesmo nó */
export interface EffectChain {
  input: AudioNode
  output: AudioNode
}

export type EffectBuilder = (ctx: AudioContext) => EffectChain

export interface PlayOptions {
  /** soma os canais antes do efeito — o pan precisa de fonte no centro */
  mono?: boolean
}

/** nível RMS alvo: os trechos vêm de faixas com volumes bem diferentes */
const TARGET_RMS = 0.12

const buffers = new Map<string, Promise<AudioBuffer>>()
let current: AudioBufferSourceNode | null = null
let playToken = 0

function loadSample(sample: ExerciseSample): Promise<AudioBuffer> {
  let p = buffers.get(sample.id)
  if (!p) {
    p = fetch(sample.file)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} em ${sample.file}`)
        return res.arrayBuffer()
      })
      .then((data) => audioContext().decodeAudioData(data))
    p.catch(() => buffers.delete(sample.id))
    buffers.set(sample.id, p)
  }
  return p
}

function bufferRms(buffer: AudioBuffer): number {
  let sum = 0
  let count = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i += 64) {
      sum += data[i] * data[i]
      count++
    }
  }
  return Math.sqrt(sum / Math.max(1, count))
}

export function preloadSample(sample: ExerciseSample): void {
  loadSample(sample).catch(() => {})
}

export function stopPlayback(): void {
  playToken++
  if (current) {
    try { current.stop() } catch { /* já tinha parado */ }
    current = null
  }
}

function playFallbackLoop(effect: EffectBuilder | undefined): void {
  const ac = audioContext()
  const chain = effect ? effect(ac) : null
  if (chain) chain.output.connect(ac.destination)
  const destination = chain?.input ?? ac.destination
  for (const semitones of [0, 4, 7]) {
    pluckNote(220 * Math.pow(2, semitones / 12), 2.2, destination)
  }
}

export function playSample(sample: ExerciseSample, effect?: EffectBuilder, options: PlayOptions = {}): void {
  stopPlayback()
  const token = playToken
  const ac = audioContext()
  if (ac.state === 'suspended') void ac.resume()
  loadSample(sample)
    .then((buffer) => {
      if (token !== playToken) return
      const source = ac.createBufferSource()
      source.buffer = buffer
      const level = ac.createGain()
      level.gain.value = Math.min(4, TARGET_RMS / Math.max(1e-4, bufferRms(buffer)))
      source.connect(level)

      let head: AudioNode = level
      if (options.mono) {
        const mono = ac.createGain()
        mono.channelCount = 1
        mono.channelCountMode = 'explicit'
        mono.channelInterpretation = 'speakers'
        head.connect(mono)
        head = mono
      }
      if (effect) {
        const chain = effect(ac)
        head.connect(chain.input)
        head = chain.output
      }
      head.connect(ac.destination)

      source.onended = () => { if (current === source) current = null }
      current = source
      source.start()
    })
    .catch(() => {
      if (token === playToken) playFallbackLoop(effect)
    })
}
