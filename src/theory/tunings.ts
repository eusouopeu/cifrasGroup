/**
 * Catálogo de afinações do violão para o motor de digitação.
 *
 * Só afeta a busca de digitações e os diagramas — a dificuldade usada pela
 * simplificação automática e pelo ranking de tons (src/theory/simplify.ts)
 * continua calculada na afinação padrão, que é a referência prática do app.
 */

export interface Tuning {
  id: string
  name: string
  /** pitch class de cada corda solta, da mais grave (6ª) para a mais aguda (1ª) */
  strings: number[]
  stringNames: string[]
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Padrão (E A D G B E)', strings: [4, 9, 2, 7, 11, 4], stringNames: ['E', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', strings: [2, 9, 2, 7, 11, 4], stringNames: ['D', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'half-down', name: 'Meio tom abaixo (Eb Ab Db Gb Bb Eb)', strings: [3, 8, 1, 6, 10, 3], stringNames: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'eb'] },
  { id: 'full-down', name: 'Um tom abaixo (D G C F A D)', strings: [2, 7, 0, 5, 9, 2], stringNames: ['D', 'G', 'C', 'F', 'A', 'd'] },
  { id: 'open-g', name: 'Open G (D G D G B D)', strings: [2, 7, 2, 7, 11, 2], stringNames: ['D', 'G', 'D', 'G', 'B', 'd'] },
]

export function tuningById(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]
}
