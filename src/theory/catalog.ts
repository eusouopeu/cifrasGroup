/** Catálogo de qualidades candidatas para a simplificação de nível 1. */

export interface QualitySpec {
  suffix: string
  intervals: number[]
  /** quanto maior, mais complexo teoricamente (critério de desempate) */
  complexity: number
  /** 'maj' | 'min' | 'neutro' — usado para não trocar o "modo" do acorde */
  color: 'maj' | 'min' | 'neutral'
}

export const CATALOG: QualitySpec[] = [
  { suffix: '', intervals: [0, 4, 7], complexity: 0, color: 'maj' },
  { suffix: 'm', intervals: [0, 3, 7], complexity: 0, color: 'min' },
  { suffix: '5', intervals: [0, 7], complexity: 1, color: 'neutral' },
  { suffix: 'sus4', intervals: [0, 5, 7], complexity: 2, color: 'neutral' },
  { suffix: 'sus2', intervals: [0, 2, 7], complexity: 2, color: 'neutral' },
  { suffix: '6', intervals: [0, 4, 7, 9], complexity: 3, color: 'maj' },
  { suffix: 'm6', intervals: [0, 3, 7, 9], complexity: 3, color: 'min' },
  { suffix: '7', intervals: [0, 4, 7, 10], complexity: 3, color: 'maj' },
  { suffix: 'm7', intervals: [0, 3, 7, 10], complexity: 3, color: 'min' },
  { suffix: '7M', intervals: [0, 4, 7, 11], complexity: 4, color: 'maj' },
  { suffix: 'add9', intervals: [0, 2, 4, 7], complexity: 4, color: 'maj' },
  { suffix: 'm(add9)', intervals: [0, 2, 3, 7], complexity: 5, color: 'min' },
  { suffix: 'dim', intervals: [0, 3, 6], complexity: 4, color: 'min' },
  { suffix: 'dim7', intervals: [0, 3, 6, 9], complexity: 5, color: 'min' },
  { suffix: 'm7(b5)', intervals: [0, 3, 6, 10], complexity: 5, color: 'min' },
  { suffix: 'aug', intervals: [0, 4, 8], complexity: 5, color: 'maj' },
  { suffix: '7sus4', intervals: [0, 5, 7, 10], complexity: 5, color: 'neutral' },
  { suffix: '7(9)', intervals: [0, 2, 4, 7, 10], complexity: 6, color: 'maj' },
  { suffix: 'm7(9)', intervals: [0, 2, 3, 7, 10], complexity: 6, color: 'min' },
  { suffix: '7M(9)', intervals: [0, 2, 4, 7, 11], complexity: 6, color: 'maj' },
  { suffix: '7(13)', intervals: [0, 4, 7, 9, 10], complexity: 7, color: 'maj' },
  { suffix: '7(b9)', intervals: [0, 1, 4, 7, 10], complexity: 7, color: 'maj' },
  { suffix: '7(#9)', intervals: [0, 3, 4, 7, 10], complexity: 8, color: 'maj' },
  { suffix: 'm7(11)', intervals: [0, 3, 5, 7, 10], complexity: 7, color: 'min' },
  { suffix: '7M(#11)', intervals: [0, 4, 6, 7, 11], complexity: 8, color: 'maj' },
  { suffix: 'm(7M)', intervals: [0, 3, 7, 11], complexity: 8, color: 'min' },
  { suffix: '9', intervals: [0, 2, 4, 7], complexity: 4, color: 'maj' },
  { suffix: 'm9', intervals: [0, 2, 3, 7, 10], complexity: 6, color: 'min' },
]

/** Só as qualidades "simples" servem de alvo da simplificação nível 1. */
export const SIMPLE_TARGETS = CATALOG.filter((q) => q.complexity <= 5)
