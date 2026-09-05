/**
 * Loop de referência dos jogos de EQ/pan/delay/compressão: uma tríade maior
 * simples tocada via pluckNote, opcionalmente roteada por um nó de efeito
 * antes da saída — assim cada jogo só precisa descrever o nó de efeito.
 */
import { audioContext, pluckNote } from '../audio/pluck'

const LOOP_ROOT_FREQ = 220 // A3
const LOOP_INTERVALS = [0, 4, 7]
const LOOP_NOTE_SECONDS = 2.2

export function playLoop(effect?: (ctx: AudioContext) => AudioNode): void {
  const ac = audioContext()
  const node = effect ? effect(ac) : null
  if (node) node.connect(ac.destination)
  const destination = node ?? ac.destination
  for (const semitones of LOOP_INTERVALS) {
    pluckNote(LOOP_ROOT_FREQ * Math.pow(2, semitones / 12), LOOP_NOTE_SECONDS, destination)
  }
}
