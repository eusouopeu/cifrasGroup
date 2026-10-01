import { ArrowsUpDownIcon } from '@heroicons/react/24/outline'
import { pluckNote } from '../../audio/pluck'
import { midiToFreq } from '../../theory/tunings'
import type { ExerciseDef, Round } from '../types'
import { shuffle } from './chords'

export interface IntervalDef {
  id: string
  label: string
  semitones: number
}

export const INTERVALS: IntervalDef[] = [
  { id: '2m', label: '2ª menor', semitones: 1 },
  { id: '2M', label: '2ª maior', semitones: 2 },
  { id: '3m', label: '3ª menor', semitones: 3 },
  { id: '3M', label: '3ª maior', semitones: 4 },
  { id: '4J', label: '4ª justa', semitones: 5 },
  { id: 'tt', label: 'Trítono', semitones: 6 },
  { id: '5J', label: '5ª justa', semitones: 7 },
  { id: '6m', label: '6ª menor', semitones: 8 },
  { id: '6M', label: '6ª maior', semitones: 9 },
  { id: '7m', label: '7ª menor', semitones: 10 },
  { id: '7M', label: '7ª maior', semitones: 11 },
  { id: '8J', label: 'Oitava', semitones: 12 },
]

/** Cada nível acrescenta intervalos ao sorteio — começa pelos mais distintos (3ª, 5ª, oitava). */
const POOL_BY_LEVEL: string[][] = [
  ['3M', '5J', '8J'],
  ['2M', '4J'],
  ['3m', '6M'],
  ['2m', '6m', '7m'],
  ['tt', '7M'],
]
const MAX_OPTIONS = 6

export interface IntervalRoundData {
  correct: IntervalDef
  options: IntervalDef[]
  /** a partir do nível 4 o intervalo também pode vir descendo */
  descending: boolean
  baseMidi: number
}

export function pickIntervalRound(level: number, rng: () => number = Math.random): IntervalRoundData {
  const ids = POOL_BY_LEVEL.slice(0, Math.max(1, level)).flat()
  const pool = INTERVALS.filter((i) => ids.includes(i.id))
  const correct = pool[Math.floor(rng() * pool.length)]
  const rest = shuffle(pool.filter((i) => i.id !== correct.id), rng).slice(0, MAX_OPTIONS - 1)
  const options = [correct, ...rest].sort((a, b) => a.semitones - b.semitones)
  return { correct, options, descending: level >= 4 && rng() < 0.5, baseMidi: 55 + Math.floor(rng() * 8) }
}

export const intervalsGame: ExerciseDef = {
  id: 'intervals',
  title: 'Intervalos',
  description: 'Duas notas em sequência: diga a distância entre elas (3ª, 5ª, oitava…). Base para tirar melodia de ouvido.',
  icon: ArrowsUpDownIcon,
  generateRound(level): Round {
    const { correct, options, descending, baseMidi } = pickIntervalRound(level)
    const first = descending ? baseMidi + correct.semitones : baseMidi
    const second = descending ? baseMidi : baseMidi + correct.semitones
    const play = () => {
      pluckNote(midiToFreq(first), 1.2)
      window.setTimeout(() => pluckNote(midiToFreq(second), 1.6), 750)
    }
    const together = () => {
      pluckNote(midiToFreq(first), 1.8)
      pluckNote(midiToFreq(second), 1.8)
    }
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'melodic', label: 'Tocar', play },
        { id: 'harmonic', label: 'Juntas', play: together },
      ],
      choices: options.map((o) => ({ id: o.id, label: o.label })),
      correctChoiceId: correct.id,
    }
  },
}
