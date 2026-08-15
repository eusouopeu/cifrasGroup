/**
 * Catálogo de afinações do violão para o motor de digitação.
 *
 * Só afeta a busca de digitações e os diagramas — a dificuldade usada pela
 * simplificação automática e pelo ranking de tons (src/theory/simplify.ts)
 * continua calculada na afinação padrão, que é a referência prática do app.
 *
 * Além das afinações fixas abaixo, o usuário pode criar as suas (store/customTunings.ts)
 * de duas formas: transpondo o "desenho" de uma afinação existente para outro
 * tom (mesma relação entre cordas, fundamental diferente), ou definindo
 * livremente as 6 cordas — o que cobre instrumentos com afinações próprias,
 * como a viola caipira.
 */

import { nameOf, preferFlatsForKey } from './notes'

export interface Tuning {
  id: string
  name: string
  /** pitch class de cada corda solta, da mais grave (6ª) para a mais aguda (1ª) */
  strings: number[]
  stringNames: string[]
  /** agrupamento na UI — 'custom' são as criadas pelo usuário (store/customTunings.ts) */
  family?: 'guitar' | 'viola' | 'custom'
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Padrão (E A D G B E)', strings: [4, 9, 2, 7, 11, 4], stringNames: ['E', 'A', 'D', 'G', 'B', 'e'], family: 'guitar' },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', strings: [2, 9, 2, 7, 11, 4], stringNames: ['D', 'A', 'D', 'G', 'B', 'e'], family: 'guitar' },
  { id: 'half-down', name: 'Meio tom abaixo (Eb Ab Db Gb Bb Eb)', strings: [3, 8, 1, 6, 10, 3], stringNames: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'eb'], family: 'guitar' },
  { id: 'full-down', name: 'Um tom abaixo (D G C F A D)', strings: [2, 7, 0, 5, 9, 2], stringNames: ['D', 'G', 'C', 'F', 'A', 'd'], family: 'guitar' },
  { id: 'open-g', name: 'Open G (D G D G B D)', strings: [2, 7, 2, 7, 11, 2], stringNames: ['D', 'G', 'D', 'G', 'B', 'd'], family: 'guitar' },
  { id: 'viola-cebolao-d', name: 'Viola caipira · Cebolão em D (D A D F# A D)', strings: [2, 9, 2, 6, 9, 2], stringNames: ['D', 'A', 'D', 'F#', 'A', 'd'], family: 'viola' },
]

/** Busca em TUNINGS e, se fornecida, também numa lista extra (afinações personalizadas do usuário). */
export function tuningById(id: string, extra: Tuning[] = []): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? extra.find((t) => t.id === id) ?? TUNINGS[0]
}

/**
 * Transpõe o "desenho" de uma afinação inteira para outra fundamental —
 * preserva a relação entre as cordas, só muda o tom geral. É o que dá,
 * por exemplo, "a afinação padrão, mas em Ré" a partir da afinação padrão.
 */
export function transposeTuningShape(base: Tuning, targetRootPc: number): { strings: number[]; stringNames: string[] } {
  const shift = ((targetRootPc - base.strings[0]) % 12 + 12) % 12
  const flats = preferFlatsForKey(targetRootPc)
  const strings = base.strings.map((pc) => (pc + shift) % 12)
  const stringNames = strings.map((pc, i) => {
    const name = nameOf(pc, flats)
    // convenção do catálogo: a 1ª corda (mais aguda) vem em minúscula
    return i === strings.length - 1 ? name.toLowerCase() : name
  })
  return { strings, stringNames }
}
