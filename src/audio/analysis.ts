/**
 * Análise de áudio com Essentia.js (WASM), usada em três pontos do app:
 * afinador (frequência dominante), tom de análise (tonalidade) e o modo
 * "conferência" de acordes (identificação de acorde tocado no microfone) e
 * a aba de voz (características espectrais do que foi cantado).
 *
 * O runtime é carregado sob demanda (import dinâmico) e reaproveitado depois
 * — a primeira chamada custa ~1s, as seguintes são só chamadas WASM síncronas.
 */

// os bindings do essentia.js não publicam tipos; `any` é o que a própria lib expõe
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EssentiaLike = any

export const SR = 44100

let essentiaPromise: Promise<EssentiaLike> | null = null

/** Espera o módulo WASM terminar de inicializar — síncrono em Node, assíncrono no navegador. */
function waitReady(mod: { calledRun?: boolean; onRuntimeInitialized?: () => void }): Promise<typeof mod> {
  if (mod.calledRun) return Promise.resolve(mod)
  return new Promise((resolve) => { mod.onRuntimeInitialized = () => resolve(mod) })
}

/** Instancia (uma única vez) o núcleo do Essentia sobre o módulo WASM. */
export async function getEssentia(): Promise<EssentiaLike> {
  if (!essentiaPromise) {
    essentiaPromise = (async () => {
      const [{ EssentiaWASM }, { default: Essentia }] = await Promise.all([
        import('essentia.js/dist/essentia-wasm.es.js'),
        import('essentia.js/dist/essentia.js-core.es.js'),
      ])
      const mod = await waitReady(EssentiaWASM)
      return new Essentia(mod)
    })()
  }
  return essentiaPromise
}

// ---------------------------------------------------------------------------
// Captura de microfone
// ---------------------------------------------------------------------------

/** Decodifica um Blob de áudio para um canal só, reamostrado em 44.1kHz. */
export async function decodeToMono(blob: Blob, sampleRate = SR): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer()
  const tmp = new OfflineAudioContext(1, 1, sampleRate)
  const decoded = await tmp.decodeAudioData(bytes)
  const ctx = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate)
  const src = ctx.createBufferSource()
  src.buffer = decoded
  src.connect(ctx.destination)
  src.start()
  const rendered = await ctx.startRendering()
  return rendered.getChannelData(0).slice()
}

const CAPTURE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

/** Grava `durationMs` do microfone e devolve o áudio decodificado, mono, 44.1kHz. */
export async function captureMicPCM(durationMs: number): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: CAPTURE_AUDIO_CONSTRAINTS })
  try {
    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    const chunks: Blob[] = []
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }))
      mr.start()
      window.setTimeout(() => mr.stop(), durationMs)
    })
    return await decodeToMono(blob)
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}

// ---------------------------------------------------------------------------
// Tonalidade
// ---------------------------------------------------------------------------

export type KeyResult = { key: string; scale: 'major' | 'minor'; strength: number }

/** Tonalidade do trecho inteiro — usada para sugerir o "tom de análise". */
export async function detectKey(audio: Float32Array): Promise<KeyResult> {
  const essentia = await getEssentia()
  const signal = essentia.arrayToVector(audio)
  try {
    const r = essentia.KeyExtractor(signal, true, 4096, 4096)
    return { key: r.key, scale: r.scale, strength: r.strength }
  } finally {
    signal.delete()
  }
}

// ---------------------------------------------------------------------------
// Acordes (com extensões) via HPCP + templates próprios
//
// O reconhecimento nativo do Essentia (ChordsDetection) só cobre tríades
// maior/menor; para extensões o caminho é computar o HPCP (perfil de croma)
// manualmente e casar com um banco de templates por intervalo.
// ---------------------------------------------------------------------------

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const CHORD_TEMPLATES: { suffix: string; intervals: number[]; penalty: number }[] = [
  { suffix: '', intervals: [0, 4, 7], penalty: 0.00 },
  { suffix: 'm', intervals: [0, 3, 7], penalty: 0.00 },
  { suffix: '5', intervals: [0, 7], penalty: 0.02 },
  { suffix: 'sus2', intervals: [0, 2, 7], penalty: 0.03 },
  { suffix: 'sus4', intervals: [0, 5, 7], penalty: 0.03 },
  { suffix: 'dim', intervals: [0, 3, 6], penalty: 0.02 },
  { suffix: 'aug', intervals: [0, 4, 8], penalty: 0.03 },
  { suffix: '6', intervals: [0, 4, 7, 9], penalty: 0.05 },
  { suffix: 'm6', intervals: [0, 3, 7, 9], penalty: 0.05 },
  { suffix: '7', intervals: [0, 4, 7, 10], penalty: 0.04 },
  { suffix: '7M', intervals: [0, 4, 7, 11], penalty: 0.04 },
  { suffix: 'm7', intervals: [0, 3, 7, 10], penalty: 0.04 },
  { suffix: 'm7(b5)', intervals: [0, 3, 6, 10], penalty: 0.06 },
  { suffix: '7sus4', intervals: [0, 5, 7, 10], penalty: 0.06 },
  { suffix: '9', intervals: [0, 2, 4, 7, 10], penalty: 0.08 },
  { suffix: '7M(9)', intervals: [0, 2, 4, 7, 11], penalty: 0.08 },
  { suffix: 'm9', intervals: [0, 2, 3, 7, 10], penalty: 0.08 },
]

const TEMPLATE_BANK = (() => {
  const bank: { symbol: string; vec: number[]; penalty: number }[] = []
  for (let root = 0; root < 12; root++) {
    for (const t of CHORD_TEMPLATES) {
      const vec = new Array(12).fill(0)
      for (const i of t.intervals) vec[(root + i) % 12] = 1
      const norm = Math.sqrt(t.intervals.length)
      bank.push({ symbol: PITCH_NAMES[root] + t.suffix, vec: vec.map((v) => v / norm), penalty: t.penalty })
    }
  }
  return bank
})()

export type ChordIdResult = { symbol: string; confidence: number } | null

/** Roda a cadeia HPCP em todos os frames do trecho e devolve o perfil de croma médio (mediana por posição). */
async function averageHpcp(essentia: EssentiaLike, audio: Float32Array): Promise<number[] | null> {
  const frameSize = 4096
  const hopSize = 2048
  const frames = essentia.FrameGenerator(audio, frameSize, hopSize)
  const chromas: number[][] = []
  const n = frames.size()
  for (let i = 0; i < n; i++) {
    const frame = frames.get(i)
    const windowed = essentia.Windowing(frame, true, frameSize, 'hann')
    const spectrum = essentia.Spectrum(windowed.frame, frameSize)
    const peaks = essentia.SpectralPeaks(spectrum.spectrum, 0.00001, 3500, 60, 60, 'frequency', SR)
    const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes, true, 500, 8)
    chromas.push(Array.from(essentia.vectorToArray(hpcp.hpcp)))
    windowed.frame.delete(); spectrum.spectrum.delete()
    peaks.frequencies.delete(); peaks.magnitudes.delete(); hpcp.hpcp.delete()
  }
  if (chromas.length === 0) return null
  return Array.from({ length: 12 }, (_, pc) => {
    const col = chromas.map((c) => c[pc]).sort((a, b) => a - b)
    return col[Math.floor(col.length / 2)]
  })
}

/** Identifica o acorde tocado num trecho de áudio (usado no modo conferência). */
export async function identifyChord(audio: Float32Array): Promise<ChordIdResult> {
  const essentia = await getEssentia()
  const profile = await averageHpcp(essentia, audio)
  if (!profile) return null
  const norm = Math.hypot(...profile)
  if (norm === 0) return null
  const unit = profile.map((v) => v / norm)

  let best = { symbol: 'N', score: -Infinity }
  for (const t of TEMPLATE_BANK) {
    let score = 0
    for (let pc = 0; pc < 12; pc++) score += unit[pc] * t.vec[pc]
    score -= t.penalty
    if (score > best.score) best = { symbol: t.symbol, score }
  }
  if (best.symbol === 'N') return null
  return { symbol: best.symbol, confidence: Math.max(0, Math.min(1, best.score)) }
}

// ---------------------------------------------------------------------------
// Frequência dominante (pitch) em tempo real — usada pelo afinador
// ---------------------------------------------------------------------------

export interface PitchReading {
  frequency: number
  confidence: number
}

/**
 * Frequência fundamental de um bloco de áudio já capturado (ex.: o buffer de
 * um AnalyserNode). Usa PitchYin (domínio do tempo) — mais leve que a
 * variante em frequência (YinFFT) porque dispensa janelamento e espectro,
 * importante aqui porque isso roda a cada quadro, em tempo real.
 */
export function pitchFromBuffer(essentia: EssentiaLike, buf: Float32Array, sampleRate: number): PitchReading | null {
  const vec = essentia.arrayToVector(buf)
  try {
    const r = essentia.PitchYin(vec, buf.length, true, sampleRate / 2, 60, sampleRate, 0.15)
    if (!r.pitch || !isFinite(r.pitch)) return null
    return { frequency: r.pitch, confidence: r.pitchConfidence }
  } finally {
    vec.delete()
  }
}

// ---------------------------------------------------------------------------
// Análise de voz — timbre de uma nota cantada
// ---------------------------------------------------------------------------

export interface VoiceReading {
  frequency: number
  note: string
  cents: number
  /** 0..1, energia relativa em cada faixa (grave/médio/agudo) — soma ~1 */
  bands: { low: number; mid: number; high: number }
  /** centro de massa espectral, em Hz — quanto maior, mais "brilhante" o timbre */
  centroid: number
  /** proxy de saturação/distorção: amostras perto do limite ÷ total, 0..1 */
  clipRatio: number
  /** fator de crista (pico/RMS) — baixo indica sinal "espremido"/comprimido */
  crestFactor: number
}

const BANDS = { low: [80, 250], mid: [250, 2000], high: [4000, 10000] } as const

/**
 * Analisa um quadro de voz cantada: altura + composição espectral (grave,
 * médio, agudo) + indícios de saturação. As faixas de frequência são as
 * mesmas usadas em análise de timbre vocal (grave = corpo/peito, médio =
 * preenchimento/projeção, agudo = brilho/presença).
 */
export function analyzeVoiceFrame(essentia: EssentiaLike, buf: Float32Array, sampleRate: number): VoiceReading | null {
  const pitch = pitchFromBuffer(essentia, buf, sampleRate)
  if (!pitch || pitch.confidence < 0.5) return null

  let peak = 0
  let sumSq = 0
  let clipped = 0
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i])
    if (a > peak) peak = a
    sumSq += buf[i] * buf[i]
    if (a > 0.97) clipped++
  }
  const rms = Math.sqrt(sumSq / buf.length)
  if (rms < 0.01) return null
  const crestFactor = rms > 0 ? peak / rms : 0
  const clipRatio = clipped / buf.length

  const frame = essentia.arrayToVector(buf)
  let bands = { low: 0, mid: 0, high: 0 }
  let centroid = 0
  try {
    const windowed = essentia.Windowing(frame, true, buf.length, 'hann')
    const spectrum = essentia.Spectrum(windowed.frame, buf.length)
    const low = essentia.EnergyBand(spectrum.spectrum, sampleRate, BANDS.low[0], BANDS.low[1]).energyBand
    const mid = essentia.EnergyBand(spectrum.spectrum, sampleRate, BANDS.mid[0], BANDS.mid[1]).energyBand
    const high = essentia.EnergyBand(spectrum.spectrum, sampleRate, BANDS.high[0], BANDS.high[1]).energyBand
    const total = low + mid + high || 1
    bands = { low: low / total, mid: mid / total, high: high / total }
    centroid = essentia.SpectralCentroidTime(frame, sampleRate).centroid
    windowed.frame.delete(); spectrum.spectrum.delete()
  } finally {
    frame.delete()
  }

  const midiFloat = 69 + 12 * Math.log2(pitch.frequency / 440)
  const midi = Math.round(midiFloat)
  return {
    frequency: pitch.frequency,
    note: `${PITCH_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`,
    cents: Math.round((midiFloat - midi) * 100),
    bands,
    centroid,
    clipRatio,
    crestFactor,
  }
}
