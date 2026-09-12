import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { playSample, preloadSample, type EffectBuilder } from '../audioEffects'
import { pickSample } from '../samples'
import type { ExerciseDef, Round } from '../types'

export const EQ_FREQ_MIN = 20
export const EQ_FREQ_MAX = 20000

const GAIN_DB_BY_LEVEL: Record<number, number> = { 1: 12, 2: 9, 3: 6, 4: 4.5, 5: 3 }
const TOLERANCE_OCTAVES_BY_LEVEL: Record<number, number> = { 1: 1, 2: 0.75, 3: 0.5, 4: 0.35, 5: 0.25 }

function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, level))
}

export interface EqRoundData {
  freqHz: number
  gainDb: number
  tolerance: number
}

export function pickEqRound(level: number, rng: () => number = Math.random): EqRoundData {
  const l = clampLevel(level)
  const minLog = Math.log2(EQ_FREQ_MIN)
  const maxLog = Math.log2(EQ_FREQ_MAX)
  const freqHz = Math.pow(2, minLog + rng() * (maxLog - minLog))
  return { freqHz, gainDb: GAIN_DB_BY_LEVEL[l], tolerance: TOLERANCE_OCTAVES_BY_LEVEL[l] }
}

function buildEqEffect(freqHz: number, gainDb: number): EffectBuilder {
  return (ctx) => {
    const filter = ctx.createBiquadFilter()
    filter.type = 'peaking'
    filter.frequency.value = freqHz
    filter.Q.value = 1
    filter.gain.value = gainDb
    return { input: filter, output: filter }
  }
}

export const eqGame: ExerciseDef = {
  id: 'eq',
  title: 'Identificar EQ',
  description: 'Compare o som original com o filtrado e aponte a frequência realçada.',
  icon: AdjustmentsHorizontalIcon,
  generateRound(level): Round {
    const { freqHz, gainDb, tolerance } = pickEqRound(level)
    const sample = pickSample()
    preloadSample(sample)
    return {
      answerMode: 'slider',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playSample(sample) },
        { id: 'wet', label: 'Tocar B (com EQ)', play: () => playSample(sample, buildEqEffect(freqHz, gainDb)) },
      ],
      credit: sample.credit,
      sliderMin: Math.log2(EQ_FREQ_MIN),
      sliderMax: Math.log2(EQ_FREQ_MAX),
      sliderLabel: (v) => `${Math.round(Math.pow(2, v))} Hz`,
      correctValue: Math.log2(freqHz),
      tolerance,
    }
  },
}
