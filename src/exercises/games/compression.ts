import { ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

interface CompressionOption {
  id: string
  label: string
  ratio: number
  threshold: number
}

const OPTIONS_LEVEL_1: CompressionOption[] = [
  { id: 'leve', label: 'Leve', ratio: 2, threshold: -18 },
  { id: 'medio', label: 'Médio', ratio: 6, threshold: -24 },
  { id: 'pesado', label: 'Pesado', ratio: 14, threshold: -30 },
]

const OPTIONS_LEVEL_3: CompressionOption[] = [
  { id: 'leve', label: 'Leve', ratio: 2, threshold: -16 },
  { id: 'leve-medio', label: 'Leve-médio', ratio: 4, threshold: -20 },
  { id: 'medio', label: 'Médio', ratio: 6, threshold: -24 },
  { id: 'medio-pesado', label: 'Médio-pesado', ratio: 9, threshold: -27 },
  { id: 'pesado', label: 'Pesado', ratio: 14, threshold: -30 },
]

function optionsForLevel(level: number): CompressionOption[] {
  return level >= 3 ? OPTIONS_LEVEL_3 : OPTIONS_LEVEL_1
}

function buildCompressionEffect(ratio: number, threshold: number) {
  return (ctx: AudioContext): AudioNode => {
    const comp = ctx.createDynamicsCompressor()
    comp.ratio.value = ratio
    comp.threshold.value = threshold
    comp.knee.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.15
    return comp
  }
}

export const compressionGame: ExerciseDef = {
  id: 'compression',
  title: 'Identificar compressão',
  icon: ArrowsPointingInIcon,
  generateRound(level): Round {
    const options = optionsForLevel(level)
    const correct = options[Math.floor(Math.random() * options.length)]
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com compressão)', play: () => playLoop(buildCompressionEffect(correct.ratio, correct.threshold)) },
      ],
      choices: options.map((o) => ({ id: o.id, label: o.label })),
      correctChoiceId: correct.id,
    }
  },
}
