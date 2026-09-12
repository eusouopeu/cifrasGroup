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
  /** crédito do trecho musical tocado (exigido pela licença CC BY) */
  credit?: string
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
  /** uma linha dizendo o que o ouvido treina aqui — a lista de exercícios só
   *  mostrava cinco botões idênticos, sem dizer por onde começar nem o que cai */
  description: string
  icon: ComponentType<{ className?: string }>
  generateRound: (level: number) => Round
}
