/**
 * Modos do afinador: contra o que a frequência lida é comparada.
 *
 * - `auto`: a corda solta mais próxima da afinação escolhida (o afinador
 *   descobre sozinho qual corda foi tocada);
 * - `string`: uma corda escolhida pelo usuário — serve para corda nova, que
 *   chega muito frouxa, ou para descer uma corda até Drop D sem o ponteiro
 *   "pular" para a corda vizinha;
 * - `chromatic`: a nota mais próxima de qualquer som, sem olhar as cordas.
 */
export type TunerMode = 'auto' | 'string' | 'chromatic'

export interface TunerTarget {
  /** índice da corda (0 = 6ª, mais grave) ou null no modo cromático */
  stringIndex: number | null
  /** desvio em cents em relação ao alvo; negativo = abaixo (apertar a corda) */
  cents: number
}

function centsBetween(freq: number, target: number): number {
  return 1200 * Math.log2(freq / target)
}

/**
 * Desvio da leitura em relação ao alvo do modo.
 *
 * No modo `string` o desvio é dobrado para dentro de ±600 cents (meia oitava):
 * o detector às vezes lê o harmônico uma oitava acima, e uma corda nunca fica
 * mais de meia oitava longe do alvo na prática.
 */
export function tunerTarget(freq: number, targetFreqs: number[], mode: TunerMode, selected: number): TunerTarget {
  if (mode === 'chromatic' || targetFreqs.length === 0) {
    const semis = 12 * Math.log2(freq / 440)
    return { stringIndex: null, cents: Math.round((semis - Math.round(semis)) * 100) }
  }
  if (mode === 'string') {
    const i = Math.max(0, Math.min(targetFreqs.length - 1, selected))
    let c = centsBetween(freq, targetFreqs[i])
    c = ((((c + 600) % 1200) + 1200) % 1200) - 600
    return { stringIndex: i, cents: Math.round(c) }
  }
  let best = 0
  let bestCents = Infinity
  targetFreqs.forEach((t, i) => {
    const c = centsBetween(freq, t)
    if (Math.abs(c) < Math.abs(bestCents)) { best = i; bestCents = c }
  })
  return { stringIndex: best, cents: Math.round(bestCents) }
}
