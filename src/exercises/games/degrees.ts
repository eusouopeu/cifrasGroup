import { ChartBarIcon } from '@heroicons/react/24/outline'
import { pluckNote } from '../../audio/pluck'
import { midiToFreq } from '../../theory/tunings'
import type { ExerciseDef, Round } from '../types'

export interface DegreeDef {
  id: string
  /** numeral romano, como aparece na análise funcional da tela da música */
  label: string
  /** posição na escala maior (0 = tônica) */
  index: number
}

export const DEGREES: DegreeDef[] = [
  { id: 'I', label: 'I', index: 0 },
  { id: 'ii', label: 'ii', index: 1 },
  { id: 'iii', label: 'iii', index: 2 },
  { id: 'IV', label: 'IV', index: 3 },
  { id: 'V', label: 'V', index: 4 },
  { id: 'vi', label: 'vi', index: 5 },
  { id: 'vii', label: 'vii°', index: 6 },
]

/** Começa pelos três acordes que sustentam a maioria das músicas e vai abrindo o campo. */
const POOL_BY_LEVEL: string[][] = [['I', 'IV', 'V'], ['vi'], ['ii'], ['iii'], ['vii']]

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

/** Tríade diatônica do grau `index` na escala maior, em semitons a partir da tônica. */
export function triadOf(index: number): number[] {
  return [0, 2, 4].map((step) => {
    const i = index + step
    return MAJOR_SCALE[i % 7] + 12 * Math.floor(i / 7)
  })
}

export interface DegreeRoundData {
  correct: DegreeDef
  options: DegreeDef[]
  keyMidi: number
}

export function pickDegreeRound(level: number, rng: () => number = Math.random): DegreeRoundData {
  const ids = POOL_BY_LEVEL.slice(0, Math.max(1, level)).flat()
  const options = DEGREES.filter((d) => ids.includes(d.id))
  const correct = options[Math.floor(rng() * options.length)]
  return { correct, options, keyMidi: 52 + Math.floor(rng() * 8) }
}

function strum(rootMidi: number, intervals: number[], seconds: number) {
  intervals.forEach((iv, i) => window.setTimeout(() => pluckNote(midiToFreq(rootMidi + iv), seconds), i * 35))
}

export const degreesGame: ExerciseDef = {
  id: 'degrees',
  title: 'Campo harmônico',
  description: 'Ouça a tônica e depois outro acorde do mesmo tom: diga qual grau ele é (I, IV, V, vi…).',
  icon: ChartBarIcon,
  generateRound(level): Round {
    const { correct, options, keyMidi } = pickDegreeRound(level)
    const target = () => strum(keyMidi + MAJOR_SCALE[correct.index], triadOf(correct.index).map((n) => n - MAJOR_SCALE[correct.index]), 1.8)
    const withTonic = () => {
      strum(keyMidi, triadOf(0), 1.4)
      window.setTimeout(target, 1200)
    }
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'context', label: 'Tônica + acorde', play: withTonic },
        { id: 'target', label: 'Só o acorde', play: target },
      ],
      choices: options.map((d) => ({ id: d.id, label: d.label })),
      correctChoiceId: correct.id,
    }
  },
}
