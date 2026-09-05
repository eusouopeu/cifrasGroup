import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

const TOLERANCE_BY_LEVEL: Record<number, number> = { 1: 0.4, 2: 0.325, 3: 0.25, 4: 0.175, 5: 0.1 }

function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, level))
}

function buildPanEffect(pan: number) {
  return (ctx: AudioContext): AudioNode => {
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    return panner
  }
}

export const panGame: ExerciseDef = {
  id: 'pan',
  title: 'Identificar pan',
  icon: ArrowsRightLeftIcon,
  generateRound(level): Round {
    const l = clampLevel(level)
    const pan = Math.random() * 2 - 1
    return {
      answerMode: 'slider',
      sounds: [
        { id: 'dry', label: 'Tocar A (centro)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com pan)', play: () => playLoop(buildPanEffect(pan)) },
      ],
      sliderMin: -1,
      sliderMax: 1,
      sliderLabel: (v) => (Math.abs(v) < 0.05 ? 'Centro' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'esquerda' : 'direita'}`),
      correctValue: pan,
      tolerance: TOLERANCE_BY_LEVEL[l],
    }
  },
}
