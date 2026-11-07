/**
 * Rolagem inteligente: decide para onde a cifra anda a partir do acorde que o
 * microfone reconheceu.
 *
 * A comparação é por "classe" do acorde (fundamental + maior/menor): o
 * reconhecimento por croma (audio/analysis.ts#identifyChord) não distingue com
 * segurança C de C7M ou C(9), mas acerta bem a tríade. O som que chega ao
 * microfone é a forma exibida mais o capotraste e o deslocamento da afinação
 * (meio tom abaixo soa um semitom abaixo da forma), então o acorde ouvido é
 * levado de volta à forma antes de comparar.
 *
 * Só se procura para a frente, numa janela curta: tocar o acorde de agora não
 * mexe na tela, e um acorde repetido mais adiante na música não faz a cifra
 * saltar estrofes inteiras.
 */
import { parseChord, transposeSymbol } from '../theory/chord'
import type { CifraLine } from '../cifra/parse'

export interface ChordEvent {
  /** índice da linha em parsed.lines (o mesmo de data-line-index) */
  line: number
  /** símbolo exibido (forma tocada no braço) */
  symbol: string
}

const STANDARD = [4, 9, 2, 7, 11, 4]
/** quantos acordes à frente o seguidor aceita pular de uma vez */
export const FOLLOW_LOOKAHEAD = 8

export function chordEvents(lines: CifraLine[], mapSymbol: (s: string) => string): ChordEvent[] {
  const out: ChordEvent[] = []
  lines.forEach((line, i) => {
    if (line.kind !== 'chords') return
    for (const c of line.chords) out.push({ line: i, symbol: mapSymbol(c.symbol) })
  })
  return out
}

/** "pc" + "m" para menor/diminuto; null se não for acorde. */
export function chordClass(symbol: string): string | null {
  const c = parseChord(symbol)
  if (!c) return null
  return `${c.rootPc}${c.triad === 'min' || c.triad === 'dim' ? 'm' : ''}`
}

/**
 * Semitons entre a forma tocada e o som: capo para cima, afinação uniforme
 * (todas as cordas deslocadas igual) para cima ou para baixo. Afinação não
 * uniforme (Drop D, abertas) não desloca as formas de forma previsível: 0.
 */
export function soundingShift(capo: number, tuningStrings: number[]): number {
  const diffs = tuningStrings.map((pc, i) => (((pc - (STANDARD[i] ?? pc)) % 12) + 12) % 12)
  const uniform = diffs.length === STANDARD.length && diffs.every((d) => d === diffs[0]) ? diffs[0] : 0
  const tuningShift = uniform > 6 ? uniform - 12 : uniform
  return capo + tuningShift
}

/** Classe do acorde ouvido, já trazida para a forma do braço. */
export function heardShapeClass(heard: string, shift: number): string | null {
  return chordClass(shift === 0 ? heard : transposeSymbol(heard, -shift))
}

/**
 * Próxima posição do seguidor. `current` é o índice do evento em que a cifra
 * está (-1 = antes do primeiro). Devolve o mesmo índice quando o acorde ouvido
 * é o atual, o índice novo quando o encontra logo à frente, ou null se não
 * casar com nada perto.
 */
export function nextFollowIndex(events: ChordEvent[], current: number, heardClass: string, lookahead = FOLLOW_LOOKAHEAD): number | null {
  if (current >= 0 && current < events.length && chordClass(events[current].symbol) === heardClass) return current
  const end = Math.min(events.length - 1, current + lookahead)
  for (let j = Math.max(0, current + 1); j <= end; j++) {
    if (chordClass(events[j].symbol) === heardClass) return j
  }
  return null
}

/** Primeiro evento a partir de uma linha — por onde o seguidor começa ao ligar. */
export function eventIndexAtLine(events: ChordEvent[], line: number): number {
  const i = events.findIndex((e) => e.line >= line)
  return i < 0 ? events.length - 1 : i - 1
}
