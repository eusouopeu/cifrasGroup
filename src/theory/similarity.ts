/**
 * Semelhança harmônica entre dois acordes.
 *
 * A ideia: nem toda nota vale o mesmo. Fundamental, terça e sétima definem o
 * acorde; quinta e tensões colorem. A semelhança pondera por essa função.
 */

import type { Chord } from './chord'

/** peso de cada intervalo (em semitons a partir da fundamental) */
function weightOf(interval: number): number {
  switch (interval) {
    case 0: return 2.2 // fundamental
    case 3: case 4: return 3.0 // terça (define maior/menor)
    case 10: case 11: return 2.2 // sétima
    case 2: case 5: return 1.6 // 9ª/11ª quando fazem as vezes de terça (sus)
    case 7: return 1.2 // quinta justa: quase sempre omitível
    case 6: case 8: return 2.6 // quinta alterada: é cor definidora, não enfeite
    case 9: return 1.4 // 6ª/13ª
    case 1: return 1.2 // b9
    default: return 0.9
  }
}

function weightMap(c: Chord): Map<number, number> {
  const m = new Map<number, number>()
  for (const i of c.intervals) {
    const pc = (c.rootPc + i) % 12
    m.set(pc, Math.max(m.get(pc) ?? 0, weightOf(i)))
  }
  return m
}

/** Terça segundo a tríade declarada (não confunde #9 com b3). */
function thirdOf(c: Chord): number | null {
  if (c.triad === 'min' || c.triad === 'dim') return 3
  if (c.triad === 'maj' || c.triad === 'aug') return 4
  return null // sus2 / sus4 / power não têm terça
}

function fifthOf(c: Chord): number {
  if (c.triad === 'dim') return 6
  if (c.triad === 'aug') return 8
  return 7
}

export interface SimilarityResult {
  score: number
  /** true quando o candidato é um subconjunto do original (substituição "por dentro") */
  subset: boolean
  lost: number[]
  added: number[]
}

/**
 * @param original acorde da cifra
 * @param candidate acorde proposto
 */
export function similarity(original: Chord, candidate: Chord): SimilarityResult {
  const wa = weightMap(original)
  const wb = weightMap(candidate)

  let shared = 0
  let totalA = 0
  let totalB = 0
  for (const [pc, w] of wa) {
    totalA += w
    if (wb.has(pc)) shared += Math.min(w, wb.get(pc)!)
  }
  for (const [, w] of wb) totalB += w

  const lost = [...wa.keys()].filter((pc) => !wb.has(pc))
  const added = [...wb.keys()].filter((pc) => !wa.has(pc))
  const subset = added.length === 0

  // fração do original preservada, com desconto pelo que foi acrescentado
  const keep = totalA > 0 ? shared / totalA : 0
  const purity = totalB > 0 ? shared / totalB : 0

  let score: number
  if (subset) {
    // substituição sem notas estranhas: o piso é alto porque nada conflita
    score = 0.6 + 0.4 * keep
  } else {
    score = 0.72 * keep + 0.28 * purity
  }

  // As comparações abaixo só fazem sentido entre acordes de mesma fundamental.
  // Com fundamentais diferentes quem faz o controle é a regra de subconjunto.
  if (original.rootPc === candidate.rootPc) {
    // trocar o modo (maior <-> menor) descaracteriza o acorde.
    // A terça vem da tríade, não dos intervalos crus: a #9 de um dominante é
    // enarmônica da terça menor e não pode ser confundida com ela.
    const thirdA = thirdOf(original)
    const thirdB = thirdOf(candidate)
    if (thirdA !== null && thirdB !== null && thirdA !== thirdB) score *= 0.45
    // abrir mão da terça (virar sus/power) tira o que define maior ou menor
    if (thirdA !== null && thirdB === null) score *= 0.75

    // quinta diminuta/aumentada é nota característica: trocá-la muda o acorde
    if (fifthOf(original) !== fifthOf(candidate)) score *= 0.7

    // acrescentar 7ª menor onde não havia cria função dominante do nada
    if (original.seventh === null && candidate.intervals.includes(10)) score *= 0.85
  }

  // Perder a sétima de um dominante muda a função harmônica. Vale para
  // qualquer fundamental, então a comparação é pela NOTA e não pelo grau —
  // senão trocas que mudam o baixo escapariam da penalidade.
  if (original.seventh === 'b7') {
    const b7 = (original.rootPc + 10) % 12
    if (!candidate.pcs.includes(b7)) score *= 0.82
  }

  return { score: Math.max(0, Math.min(1, score)), subset, lost, added }
}
