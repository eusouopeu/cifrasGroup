import { ClockIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

interface DelayOption {
  id: string
  label: string
  ms: number
}

const OPTIONS_LEVEL_1: DelayOption[] = [
  { id: '80', label: 'Curto (~80ms)', ms: 80 },
  { id: '250', label: 'Médio (~250ms)', ms: 250 },
  { id: '500', label: 'Longo (~500ms)', ms: 500 },
]

const OPTIONS_LEVEL_3: DelayOption[] = [
  { id: '80', label: '~80ms', ms: 80 },
  { id: '150', label: '~150ms', ms: 150 },
  { id: '250', label: '~250ms', ms: 250 },
  { id: '350', label: '~350ms', ms: 350 },
  { id: '500', label: '~500ms', ms: 500 },
]

function optionsForLevel(level: number): DelayOption[] {
  return level >= 3 ? OPTIONS_LEVEL_3 : OPTIONS_LEVEL_1
}

function buildDelayEffect(ms: number, feedbackAmount: number) {
  return (ctx: AudioContext): AudioNode => {
    const delay = ctx.createDelay(1)
    delay.delayTime.value = ms / 1000
    const feedback = ctx.createGain()
    feedback.gain.value = feedbackAmount
    delay.connect(feedback)
    feedback.connect(delay)
    return delay
  }
}

export const delayGame: ExerciseDef = {
  id: 'delay',
  title: 'Identificar delay',
  icon: ClockIcon,
  generateRound(level): Round {
    const options = optionsForLevel(level)
    const correct = options[Math.floor(Math.random() * options.length)]
    const feedbackAmount = level >= 3 ? 0.2 : 0.35
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com delay)', play: () => playLoop(buildDelayEffect(correct.ms, feedbackAmount)) },
      ],
      choices: options.map((o) => ({ id: o.id, label: o.label })),
      correctChoiceId: correct.id,
    }
  },
}
