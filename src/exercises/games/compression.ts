import { ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import { playSample, preloadSample, type EffectBuilder } from '../audioEffects'
import { pickSample } from '../samples'
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

function buildCompressionEffect(ratio: number, threshold: number): EffectBuilder {
  return (ctx) => {
    const comp = ctx.createDynamicsCompressor()
    comp.ratio.value = ratio
    comp.threshold.value = threshold
    comp.knee.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.15
    // ganho de compensação aproximado: sem ele o B só soa "mais baixo" e o
    // ouvido julga pelo volume em vez de pela dinâmica achatada
    const makeup = ctx.createGain()
    makeup.gain.value = Math.pow(10, (-threshold * (1 - 1 / ratio) * 0.5) / 20)
    comp.connect(makeup)
    return { input: comp, output: makeup }
  }
}

export const compressionGame: ExerciseDef = {
  id: 'compression',
  title: 'Identificar compressão',
  description: 'Perceba o quanto a dinâmica foi achatada: leve, médio ou pesado.',
  icon: ArrowsPointingInIcon,
  generateRound(level): Round {
    const options = optionsForLevel(level)
    const correct = options[Math.floor(Math.random() * options.length)]
    const sample = pickSample()
    preloadSample(sample)
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playSample(sample) },
        { id: 'wet', label: 'Tocar B (com compressão)', play: () => playSample(sample, buildCompressionEffect(correct.ratio, correct.threshold)) },
      ],
      credit: sample.credit,
      choices: options.map((o) => ({ id: o.id, label: o.label })),
      correctChoiceId: correct.id,
    }
  },
}
