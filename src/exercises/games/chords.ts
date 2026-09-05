import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import { pluckNote } from '../../audio/pluck'
import { midiToFreq } from '../../theory/tunings'
import type { ExerciseDef, Round } from '../types'

export interface ChordQuality {
  id: string
  label: string
  intervals: number[]
}

export const CHORD_QUALITIES: ChordQuality[] = [
  { id: 'maj', label: 'Maior', intervals: [0, 4, 7] },
  { id: 'min', label: 'Menor', intervals: [0, 3, 7] },
  { id: 'dim', label: 'Diminuto', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Aumentado', intervals: [0, 4, 8] },
  { id: 'maj7', label: '7ª maior', intervals: [0, 4, 7, 11] },
  { id: '7', label: '7ª (dominante)', intervals: [0, 4, 7, 10] },
  { id: 'm7b5', label: 'Meio-diminuto', intervals: [0, 3, 6, 10] },
  { id: 'dim7', label: 'Diminuto com 7ª', intervals: [0, 3, 6, 9] },
]

const CHORD_ROOT_MIDI = 60 // C4

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface ChordRoundData {
  rootPc: number
  correct: ChordQuality
  options: ChordQuality[]
}

/** Nível controla quantas qualidades entram como opção (mín. 5, todas as 8 a partir do nível 4). */
export function pickChordRound(level: number, rng: () => number = Math.random): ChordRoundData {
  const numOptions = Math.min(4 + level, CHORD_QUALITIES.length)
  const rootPc = Math.floor(rng() * 12)
  const correct = CHORD_QUALITIES[Math.floor(rng() * CHORD_QUALITIES.length)]
  const pool = CHORD_QUALITIES.filter((q) => q.id !== correct.id)
  const distractors: ChordQuality[] = []
  while (distractors.length < numOptions - 1 && pool.length > 0) {
    distractors.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  const options = shuffle([correct, ...distractors], rng)
  return { rootPc, correct, options }
}

export const chordsGame: ExerciseDef = {
  id: 'chords',
  title: 'Reconhecer acordes',
  icon: MusicalNoteIcon,
  generateRound(level): Round {
    const { rootPc, correct, options } = pickChordRound(level)
    const play = () => correct.intervals.forEach((iv) => pluckNote(midiToFreq(CHORD_ROOT_MIDI + rootPc + iv), 1.6))
    return {
      answerMode: 'choice',
      sounds: [{ id: 'chord', label: 'Tocar acorde', play }],
      choices: options.map((q) => ({ id: q.id, label: q.label })),
      correctChoiceId: correct.id,
    }
  },
}
