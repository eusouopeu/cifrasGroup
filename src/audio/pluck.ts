/**
 * Som de corda de violão pontual (fora do metrônomo), usado pelo afinador para
 * tocar a nota-alvo de cada corda.
 *
 * Síntese por Karplus-Strong: um estouro de ruído passa por um atraso de um
 * período realimentado com média de duas amostras, que é justamente o que dá o
 * ataque com brilho e a queda gradual dos harmônicos de uma corda pinçada —
 * um oscilador puro soa como apito e não serve de referência de afinação.
 * O ciclo é gerado direto num AudioBuffer (JS), sem nós de delay realimentados.
 */

let ctx: AudioContext | null = null

function audioContext(): AudioContext {
  if (!ctx) {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

function karplusStrong(ac: AudioContext, freq: number, seconds: number): AudioBuffer {
  const sr = ac.sampleRate
  const n = Math.floor(sr * seconds)
  const period = Math.max(2, Math.round(sr / freq))
  const buf = ac.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)

  for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1
  // < 1 controla quanto o som demora a morrer; ligado ao período para que a
  // corda grave sustente mais que a aguda, como no instrumento real
  const decay = 0.996 + Math.min(0.0035, period / sr / 3)
  for (let i = period; i < n; i++) data[i] = decay * 0.5 * (data[i - period] + data[i - period + 1])

  // envelope de saída: ataque curtíssimo e queda final suave, para não estalar
  const attack = Math.floor(sr * 0.004)
  const release = Math.floor(sr * 0.08)
  for (let i = 0; i < n; i++) {
    let g = 1
    if (i < attack) g = i / attack
    else if (i > n - release) g = (n - i) / release
    data[i] *= g * 0.55
  }
  return buf
}

/** Toca uma nota com timbre de corda pinçada. `freq` em Hz. */
export function pluckNote(freq: number, seconds = 1.8): void {
  const ac = audioContext()
  if (ac.state === 'suspended') void ac.resume()
  const src = ac.createBufferSource()
  src.buffer = karplusStrong(ac, freq, seconds)
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = Math.min(ac.sampleRate / 2 - 1000, freq * 12)
  const gain = ac.createGain()
  gain.gain.value = 0.9
  src.connect(tone).connect(gain).connect(ac.destination)
  src.start()
}
