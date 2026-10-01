import { HandRaisedIcon } from '@heroicons/react/24/outline'
import { pluckNote } from '../../audio/pluck'
import { midiToFreq } from '../../theory/tunings'
import type { ExerciseDef, Round } from '../types'
import { shuffle } from './chords'

/** Um compasso 4/4 em colcheias: 8 posições, índice par = tempo, ímpar = "e". */
const STEPS = 8
const BPM = 80

export interface RhythmPattern {
  /** string de 0/1 — serve de id e garante opções distintas */
  id: string
  steps: boolean[]
}

function fromSteps(steps: boolean[]): RhythmPattern {
  return { id: steps.map((s) => (s ? '1' : '0')).join(''), steps }
}

/** Posições que o nível permite mexer: no nível 1 só os tempos; o 1º tempo sempre soa. */
function editable(level: number): number[] {
  return Array.from({ length: STEPS }, (_, i) => i).filter((i) => i > 0 && (level > 1 || i % 2 === 0))
}

function randomPattern(level: number, rng: () => number): RhythmPattern {
  const steps = Array.from({ length: STEPS }, (_, i) => i === 0)
  for (const i of editable(level)) steps[i] = rng() < (i % 2 === 0 ? 0.7 : 0.45)
  return fromSteps(steps)
}

/** Distrator = o padrão certo com algumas posições trocadas; em nível alto troca menos, fica mais parecido. */
function variant(base: RhythmPattern, level: number, rng: () => number): RhythmPattern {
  const flips = level >= 4 ? 1 : 2
  const steps = [...base.steps]
  for (const i of shuffle(editable(level), rng).slice(0, flips)) steps[i] = !steps[i]
  return fromSteps(steps)
}

export interface RhythmRoundData {
  correct: RhythmPattern
  options: RhythmPattern[]
}

export function pickRhythmRound(level: number, rng: () => number = Math.random): RhythmRoundData {
  const numOptions = level >= 5 ? 5 : level >= 3 ? 4 : 3
  const correct = randomPattern(level, rng)
  const seen = new Set([correct.id])
  const options = [correct]
  for (let guard = 0; options.length < numOptions && guard < 200; guard++) {
    const candidate = guard < 100 ? variant(correct, level, rng) : randomPattern(level, rng)
    if (seen.has(candidate.id)) continue
    seen.add(candidate.id)
    options.push(candidate)
  }
  return { correct, options: shuffle(options, rng) }
}

/** "● · ● ●" por tempo: lido de relance, sem precisar saber partitura. */
export function rhythmLabel(p: RhythmPattern): string {
  const beats: string[] = []
  for (let b = 0; b < STEPS; b += 2) beats.push(`${p.steps[b] ? '●' : '○'}${p.steps[b + 1] ? '●' : '·'}`)
  return beats.join('  ')
}

function playPattern(p: RhythmPattern) {
  const eighth = 60_000 / BPM / 2
  // um compasso de contagem antes, para saber onde cai o "1"
  for (let b = 0; b < 4; b++) window.setTimeout(() => pluckNote(midiToFreq(b === 0 ? 84 : 79), 0.12), b * eighth * 2)
  p.steps.forEach((on, i) => {
    if (on) window.setTimeout(() => pluckNote(midiToFreq(57), 0.35), (STEPS + i) * eighth)
  })
}

export const rhythmGame: ExerciseDef = {
  id: 'rhythm',
  title: 'Ditado rítmico',
  description: 'Depois de quatro cliques de contagem, um compasso de batidas: escolha o desenho que soou. ● = toque, ○/· = pausa.',
  icon: HandRaisedIcon,
  generateRound(level): Round {
    const { correct, options } = pickRhythmRound(level)
    return {
      answerMode: 'choice',
      sounds: [{ id: 'pattern', label: 'Tocar compasso', play: () => playPattern(correct) }],
      choices: options.map((o) => ({ id: o.id, label: rhythmLabel(o) })),
      correctChoiceId: correct.id,
    }
  },
}
