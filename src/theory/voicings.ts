/**
 * Busca de digitações no violão (afinação padrão) e cálculo de dificuldade.
 *
 * Prioridade de facilidade pedida pelo usuário, em ordem:
 *   1. menos cordas mudas
 *   2. sem pestana
 *   3. mais cordas soltas e menos dedos
 *   4. mais perto da cabeça do braço
 */

import type { Chord } from './chord'
import { parseChord } from './chord'

/** cordas de baixo (6ª) para cima (1ª): E A D G B E */
export const STANDARD_TUNING = [4, 9, 2, 7, 11, 4]
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e']
const MAX_FRET = 14
const WINDOW = 3 // amplitude máxima entre a menor e a maior casa pisada

export interface Voicing {
  /** casa por corda, índice 0 = 6ª corda (mais grave). null = corda muda. */
  frets: (number | null)[]
  muted: number
  interiorMuted: number
  open: number
  fingers: number
  barre: number | null
  minFret: number
  maxFret: number
  span: number
  bassPc: number
  cost: number
}

interface SearchOpts {
  requireRootInBass?: boolean
  allowRootless?: boolean
  maxResults?: number
  /** afinação a usar na busca; padrão é a afinação-padrão do violão */
  tuning?: number[]
}

function costOf(v: Omit<Voicing, 'cost'>, targetBassPc: number): number {
  let c = 0
  c += 60 * v.muted // (1) cordas mudas
  c += 50 * v.interiorMuted // muda no meio é bem pior que muda na ponta
  c += v.barre !== null ? 200 : 0 // (2) pestana
  c += 30 * v.fingers // (3) menos dedos...
  c -= 45 * v.open //     ...e mais cordas soltas
  c += 25 * v.minFret // (4) perto da cabeça
  c += 10 * v.span
  // Inversão involuntária pesa mais que corda muda: deixar uma corda de fora é
  // incômodo, mas trocar a nota do baixo troca o acorde.
  if (v.bassPc !== targetBassPc) c += 300
  return c
}

function analyze(frets: (number | null)[], targetBassPc: number, tuning: number[]): Voicing | null {
  const sounded: number[] = []
  frets.forEach((f, i) => {
    if (f !== null) sounded.push(i)
  })
  if (sounded.length < 3) return null

  const muted = 6 - sounded.length
  const first = sounded[0]
  const last = sounded[sounded.length - 1]
  let interiorMuted = 0
  for (let i = first; i <= last; i++) if (frets[i] === null) interiorMuted++

  const fretted = frets.filter((f): f is number => f !== null && f > 0)
  const open = frets.filter((f) => f === 0).length
  const minFret = fretted.length ? Math.min(...fretted) : 0
  const maxFret = fretted.length ? Math.max(...fretted) : 0
  const span = fretted.length ? maxFret - minFret : 0
  if (span > WINDOW) return null

  // Pestana: um dedo deitado cobre um trecho contínuo de cordas na casa mínima.
  // Ele abafa tudo o que estiver embaixo, então não pode haver corda solta
  // dentro do trecho coberto — se houver, essa forma é dedo a dedo, não pestana.
  let barre: number | null = null
  let fingers = fretted.length
  // Duas notas na mesma casa não são pestana: com até 4 notas pisadas o
  // violonista usa um dedo em cada. A pestana só entra quando é necessária.
  if (minFret > 0 && fretted.length > 4) {
    const atMinIdx = frets.map((f, i) => (f === minFret ? i : -1)).filter((i) => i >= 0)
    if (atMinIdx.length >= 2) {
      const from = atMinIdx[0]
      const to = atMinIdx[atMinIdx.length - 1]
      let openInside = false
      for (let i = from; i <= to; i++) if (frets[i] === 0) openInside = true
      if (!openInside) {
        barre = minFret
        fingers = fretted.length - atMinIdx.length + 1
      }
    }
  }
  if (fingers > 4) return null
  // mãos humanas: no máximo 4 notas pisadas distintas fora da pestana
  if (barre === null && fretted.length > 4) return null

  const bassPc = (tuning[first] + (frets[first] as number)) % 12

  const base = { frets, muted, interiorMuted, open, fingers, barre, minFret, maxFret, span, bassPc }
  return { ...base, cost: costOf(base, targetBassPc) }
}

const cache = new Map<string, Voicing[]>()

/** Busca as melhores digitações para um acorde. Resultado em cache por símbolo. */
export function findVoicings(chord: Chord, opts: SearchOpts = {}): Voicing[] {
  const tuning = opts.tuning ?? STANDARD_TUNING
  const key = `${chord.pcs.slice().sort().join(',')}|${chord.rootPc}|${chord.bassPc ?? '-'}|${opts.allowRootless ? 1 : 0}|${tuning.join(',')}`
  // o cache guarda a lista inteira; maxResults é só um recorte na saída
  const hit = cache.get(key)
  if (hit) return hit.slice(0, opts.maxResults ?? 8)

  const pcSet = new Set(chord.pcs)
  const rootPc = chord.rootPc
  const targetBass = chord.bassPc ?? rootPc
  const essential = new Set<number>()
  essential.add(rootPc)
  const third = chord.intervals.find((i) => i === 3 || i === 4 || i === 2 || i === 5)
  if (third !== undefined) essential.add((rootPc + third) % 12)
  if (chord.seventh) {
    const sv = chord.seventh === 'b7' ? 10 : chord.seventh === 'maj7' ? 11 : 9
    essential.add((rootPc + sv) % 12)
  }
  for (const t of chord.tensions) essential.add((rootPc + t) % 12)
  if (opts.allowRootless && essential.size > 3) essential.delete(rootPc)

  const results: Voicing[] = []
  const seen = new Set<string>()

  for (let w = 0; w <= MAX_FRET - WINDOW; w++) {
    // opções por corda dentro da janela [w, w+WINDOW]
    const options: (number | null)[][] = tuning.map((openPc) => {
      const opts2: (number | null)[] = [null]
      if (pcSet.has(openPc)) opts2.push(0)
      for (let f = Math.max(1, w); f <= w + WINDOW; f++) {
        if (pcSet.has((openPc + f) % 12)) opts2.push(f)
      }
      return opts2
    })

    const current: (number | null)[] = new Array(6).fill(null)
    const dfs = (i: number, mutedSoFar: number) => {
      if (mutedSoFar > 2) return
      if (i === 6) {
        const v = analyze(current.slice(), targetBass, tuning)
        if (!v) return
        // cobertura das notas essenciais
        const got = new Set<number>()
        current.forEach((f, s) => {
          if (f !== null) got.add((tuning[s] + f) % 12)
        })
        for (const e of essential) if (!got.has(e)) return
        if (!got.has(rootPc) && !opts.allowRootless) return
        if (opts.requireRootInBass && v.bassPc !== targetBass) return
        const sig = current.map((f) => (f === null ? 'x' : f)).join('-')
        if (seen.has(sig)) return
        seen.add(sig)
        results.push(v)
        return
      }
      for (const o of options[i]) {
        current[i] = o
        dfs(i + 1, mutedSoFar + (o === null ? 1 : 0))
      }
      current[i] = null
    }
    dfs(0, 0)
    if (w === 0) continue
  }

  results.sort((a, b) => a.cost - b.cost)
  const top = results.slice(0, 12)
  cache.set(key, top)
  return top.slice(0, opts.maxResults ?? 8)
}

const difficultyCache = new Map<string, number>()

/** Custo da melhor digitação disponível. Quanto menor, mais fácil. */
export function chordDifficulty(symbol: string): number {
  const hit = difficultyCache.get(symbol)
  if (hit !== undefined) return hit
  const c = parseChord(symbol)
  let d = 1200
  if (c) {
    let vs = findVoicings(c, { maxResults: 3 })
    if (vs.length === 0) vs = findVoicings(c, { allowRootless: true, maxResults: 3 })
    d = vs.length ? vs[0].cost : 1200
  }
  difficultyCache.set(symbol, d)
  return d
}

export function bestVoicing(symbol: string, tuning: number[] = STANDARD_TUNING): Voicing | null {
  const c = parseChord(symbol)
  if (!c) return null
  let vs = findVoicings(c, { maxResults: 6, tuning })
  if (vs.length === 0) vs = findVoicings(c, { allowRootless: true, maxResults: 6, tuning })
  return vs[0] ?? null
}

export function allVoicings(symbol: string, max = 6, tuning: number[] = STANDARD_TUNING): Voicing[] {
  const c = parseChord(symbol)
  if (!c) return []
  let vs = findVoicings(c, { maxResults: max, tuning })
  if (vs.length === 0) vs = findVoicings(c, { allowRootless: true, maxResults: max, tuning })
  return vs
}

/** Rótulos "T / 3 / 5 / b7" por corda, para exibir a construção no diagrama. */
export function voicingDegrees(v: Voicing, rootPc: number, tuning: number[] = STANDARD_TUNING): (string | null)[] {
  const labels: Record<number, string> = {
    0: 'T', 1: 'b9', 2: '9', 3: 'b3', 4: '3', 5: '11', 6: 'b5', 7: '5', 8: '#5', 9: '13', 10: 'b7', 11: '7M',
  }
  return v.frets.map((f, s) => {
    if (f === null) return null
    const pc = (tuning[s] + f) % 12
    return labels[(pc - rootPc + 12) % 12] ?? '?'
  })
}
