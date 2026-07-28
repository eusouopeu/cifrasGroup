/**
 * Simplificação automática em dois níveis.
 *
 * Nível 1 — troca cada acorde por outro com semelhança >= limiar, preferindo
 *           (a) o mais fácil no violão, depois (b) o mais simples na teoria.
 * Nível 2 — procura o tom em que o conjunto de acordes (já simplificado) fica
 *           mais fácil de tocar, e sugere o capotraste que devolve o tom original.
 */

import { buildSymbol, parseChord, transposeSymbol, type Chord } from './chord'
import { CATALOG, SIMPLE_TARGETS } from './catalog'
import { similarity } from './similarity'
import { chordDifficulty } from './voicings'
import { preferFlatsForKey } from './notes'

export interface Substitution {
  from: string
  to: string
  score: number
  difficultyBefore: number
  difficultyAfter: number
  reason: string
  alternatives: { symbol: string; score: number; difficulty: number }[]
}

function candidateChord(rootPc: number, suffix: string, bassPc: number | null, flats: boolean): Chord | null {
  return parseChord(buildSymbol(rootPc, suffix, bassPc, flats))
}

/**
 * Nível 1: simplifica um acorde isolado.
 * @param threshold semelhança mínima (0..1), padrão 0.8
 */
export function simplifyChord(symbol: string, threshold = 0.8): Substitution | null {
  const original = parseChord(symbol)
  if (!original) return null

  // Mantém a grafia do original: F#m7(b5) vira F#m7, nunca Gbm7.
  // Só o acidente da fundamental conta — o "b" de "(b5)" não é grafia de nota.
  const rootAccidental = /^[A-G]([#b])/.exec(symbol)?.[1]
  const flats = rootAccidental ? rootAccidental === 'b' : preferFlatsForKey(original.rootPc)
  const originalDifficulty = chordDifficulty(symbol)
  const originalComplexity =
    CATALOG.find((q) => q.intervals.length === original.intervals.length && q.intervals.every((i) => original.intervals.includes(i)))?.complexity ?? 6 + original.tensions.length

  type Cand = { symbol: string; score: number; difficulty: number; complexity: number; sameRoot: boolean }
  const cands: Cand[] = []

  for (let root = 0; root < 12; root++) {
    for (const q of SIMPLE_TARGETS) {
      // simplificar nunca pode aumentar a complexidade teórica
      if (q.complexity > originalComplexity) continue
      // mantém o baixo original só quando a fundamental não mudou
      const bass = root === original.rootPc ? original.bassPc : null
      const sym = buildSymbol(root, q.suffix, bass, flats)
      if (sym === symbol) continue
      const cand = candidateChord(root, q.suffix, bass, flats)
      if (!cand) continue
      const sim = similarity(original, cand)
      if (sim.score < threshold) continue
      // substituição de fundamental só vale se não introduzir nota estranha
      if (root !== original.rootPc && !sim.subset) continue
      cands.push({
        symbol: sym,
        score: sim.score,
        difficulty: chordDifficulty(sym),
        complexity: q.complexity,
        sameRoot: root === original.rootPc,
      })
    }
  }

  if (cands.length === 0) return null

  cands.sort((a, b) => {
    // (0) manter a fundamental vem antes de tudo: trocá-la muda o baixo da
    // música. Substituições sem fundamental (o clássico G7(b9) -> Bº) ficam
    // disponíveis na lista de alternativas, mas não entram automaticamente.
    if (a.sameRoot !== b.sameRoot) return a.sameRoot ? -1 : 1
    // (a) mais fácil no violão — diferenças pequenas de custo são empate
    const dd = a.difficulty - b.difficulty
    if (Math.abs(dd) > 15) return dd
    // (b) mais simples na teoria
    if (a.complexity !== b.complexity) return a.complexity - b.complexity
    // (c) mais parecido
    return b.score - a.score
  })

  const best = cands[0]
  // só troca se realmente ficar mais fácil ou mais simples
  if (best.difficulty >= originalDifficulty - 10 && best.complexity >= originalComplexity) return null

  const reasons: string[] = []
  if (best.difficulty < originalDifficulty - 10) reasons.push('mais fácil no violão')
  if (best.complexity < originalComplexity) reasons.push('construção mais simples')
  if (!best.sameRoot) reasons.push('atenção: muda a nota do baixo')

  return {
    from: symbol,
    to: best.symbol,
    score: best.score,
    difficultyBefore: originalDifficulty,
    difficultyAfter: best.difficulty,
    reason: reasons.join(' · ') || 'equivalente mais direto',
    alternatives: cands.slice(1, 6).map((c) => ({ symbol: c.symbol, score: c.score, difficulty: c.difficulty })),
  }
}

/** Nível 1 aplicado à lista de acordes únicos da música. */
export function simplifyLevel1(symbols: string[], threshold = 0.8): Map<string, Substitution> {
  const out = new Map<string, Substitution>()
  for (const s of new Set(symbols)) {
    const sub = simplifyChord(s, threshold)
    if (sub) out.set(s, sub)
  }
  return out
}

export interface KeyOption {
  /** semitons de transposição a aplicar na cifra */
  semitones: number
  /** casa do capotraste para o tom soar como o original (0 = sem capo) */
  capo: number
  difficulty: number
  /** dificuldade média por acorde, normalizada para leitura humana (0-100) */
  ease: number
  chords: string[]
  hardest: string
}

const CAPO_PENALTY = 12
const MAX_CAPO = 7

/**
 * Nível 2: ranking de tons por facilidade.
 * @param symbols acordes da música (com repetições — a frequência conta)
 */
export function rankKeys(symbols: string[]): KeyOption[] {
  const counts = new Map<string, number>()
  for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1)

  const options: KeyOption[] = []
  for (let t = 0; t < 12; t++) {
    let total = 0
    let weight = 0
    let hardest = ''
    let hardestCost = -1
    const uniq: string[] = []
    for (const [sym, n] of counts) {
      const moved = transposeSymbol(sym, t)
      const d = chordDifficulty(moved)
      total += d * n
      weight += n
      uniq.push(moved)
      if (d > hardestCost) {
        hardestCost = d
        hardest = moved
      }
    }
    const capo = (12 - t) % 12
    const usableCapo = capo <= MAX_CAPO ? capo : 0
    const avg = weight ? total / weight : 0
    options.push({
      semitones: t,
      capo: usableCapo,
      difficulty: avg + usableCapo * CAPO_PENALTY,
      ease: 0,
      chords: uniq,
      hardest,
    })
  }

  const min = Math.min(...options.map((o) => o.difficulty))
  const max = Math.max(...options.map((o) => o.difficulty))
  for (const o of options) {
    o.ease = max > min ? Math.round(100 - ((o.difficulty - min) / (max - min)) * 100) : 100
  }
  options.sort((a, b) => a.difficulty - b.difficulty)
  return options
}

/** Melhor tom mantendo a altura original via capotraste (capo <= MAX_CAPO). */
export function bestKeyWithCapo(symbols: string[]): KeyOption | null {
  const ranked = rankKeys(symbols).filter((o) => o.capo > 0 && o.capo <= MAX_CAPO)
  return ranked[0] ?? null
}
