import { STROKE_LABEL, type Rhythm } from '../data/rhythms'

/**
 * Grade de batida: cada coluna é uma semicolcheia, agrupada por tempo.
 * `activeStep` acende a coluna que o metrônomo está tocando agora.
 */
export function BatidaGrid({ rhythm, activeStep = -1 }: { rhythm: Rhythm; activeStep?: number }) {
  const strokes = rhythm.pattern.split('')
  const beats: { stroke: string; index: number }[][] = []
  for (let i = 0; i < strokes.length; i += rhythm.subdivision) {
    beats.push(strokes.slice(i, i + rhythm.subdivision).map((stroke, j) => ({ stroke, index: i + j })))
  }
  return (
    <div className="batida">
      {beats.map((beat, bi) => (
        <div key={bi} className="batida-beat">
          <div className="batida-cells">
            {beat.map(({ stroke, index }) => (
              <span
                key={index}
                className={`stroke stroke-${stroke === '.' ? 'rest' : stroke.toLowerCase()}${index === activeStep ? ' active' : ''}`}
              >
                {STROKE_LABEL[stroke] ?? stroke}
              </span>
            ))}
          </div>
          <div className="batida-num">{bi + 1}</div>
        </div>
      ))}
    </div>
  )
}

/** Grade de dedilhado: passos "cordas:dedos". */
export function DedilhadoGrid({ rhythm, activeStep = -1 }: { rhythm: Rhythm; activeStep?: number }) {
  const steps = rhythm.pattern.split(/\s+/).filter(Boolean)
  return (
    <div className="dedilhado">
      {steps.map((step, i) => {
        const [strings, fingers] = step.split(':')
        return (
          <div key={i} className={`ded-step${i === activeStep ? ' active' : ''}`}>
            <div className="ded-strings">{strings.split('').join('·')}</div>
            <div className="ded-fingers">{fingers}</div>
          </div>
        )
      })}
    </div>
  )
}

export function RhythmGrid({ rhythm, activeStep }: { rhythm: Rhythm; activeStep?: number }) {
  return rhythm.kind === 'batida'
    ? <BatidaGrid rhythm={rhythm} activeStep={activeStep} />
    : <DedilhadoGrid rhythm={rhythm} activeStep={activeStep} />
}

export function RhythmCard({ rhythm, selected, onSelect }: {
  rhythm: Rhythm
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button className={`rhythmcard${selected ? ' selected' : ''}`} onClick={onSelect}>
      <div className="rhythmcard-head">
        <span className="rhythmcard-name">{rhythm.name}</span>
        <span className="tag">{rhythm.meter}</span>
        <span className="tag muted">{rhythm.bpmSuggested} bpm</span>
      </div>
      <RhythmGrid rhythm={rhythm} />
      <div className="rhythmcard-genres">{rhythm.genres.join(' · ')}</div>
      {rhythm.hint && <div className="rhythmcard-hint">{rhythm.hint}</div>}
    </button>
  )
}
