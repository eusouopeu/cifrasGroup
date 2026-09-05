import type { ComponentType } from 'react'

export type AnswerMode = 'choice' | 'slider'

export interface RoundSound {
  id: string
  label: string
  play: () => void
}

export interface RoundChoice {
  id: string
  label: string
}

export interface Round {
  sounds: RoundSound[]
  answerMode: AnswerMode
  // modo 'choice'
  choices?: RoundChoice[]
  correctChoiceId?: string
  // modo 'slider'
  sliderMin?: number
  sliderMax?: number
  sliderLabel?: (value: number) => string
  correctValue?: number
  tolerance?: number
}

export interface ExerciseDef {
  id: string
  title: string
  icon: ComponentType<{ className?: string }>
  generateRound: (level: number) => Round
}
