import { PlayIcon } from '@heroicons/react/24/outline'
import { STROKE_LABEL, genreColorClass, type Rhythm } from '../data/rhythms'

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
  const STROKE_CLASS: Record<string, string> = {
    rest: 'opacity-30',
    d: 'text-accent font-bold',
    u: 'text-accent2',
    x: 'text-dim',
    p: 'text-accent text-[.68rem]',
    a: 'text-accent text-[.68rem]',
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {beats.map((beat, bi) => (
        <div key={bi} className="flex-none flex flex-col items-center">
          <div className="flex gap-px">
            {beat.map(({ stroke, index }) => {
              const kind = stroke === '.' ? 'rest' : stroke.toLowerCase()
              const active = index === activeStep
              return (
                <span
                  key={index}
                  className={`w-[13px] h-[21px] grid place-items-center text-[.78rem] rounded-sm ${
                    active ? 'bg-accent text-[#14161a] scale-[1.12]' : 'bg-bg2'
                  } ${active ? '' : STROKE_CLASS[kind] ?? ''}`}
                >
                  {STROKE_LABEL[stroke] ?? stroke}
                </span>
              )
            })}
          </div>
          <div className="text-[.6rem] text-dim mt-px">{bi + 1}</div>
        </div>
      ))}
    </div>
  )
}

const FINGER_NAME: Record<string, string> = { p: 'polegar', i: 'indicador', m: 'médio', a: 'anelar' }

/** Grade de dedilhado: passos "cordas:dedos". */
export function DedilhadoGrid({ rhythm, activeStep = -1 }: { rhythm: Rhythm; activeStep?: number }) {
  const steps = rhythm.pattern.split(/\s+/).filter(Boolean)
  return (
    <div className="flex gap-1.5 flex-wrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:flex-none">
      {steps.map((step, i) => {
        const [strings, fingers] = step.split(':')
        const title = fingers.split('').map((f) => FINGER_NAME[f] ?? f).join(' + ')
        const active = i === activeStep
        return (
          <div
            key={i}
            className={`rounded text-center min-w-[30px] py-[.15rem] px-[.3rem] ${active ? 'bg-accent' : 'bg-bg2'}`}
            title={title}
          >
            <div className={`font-mono text-[.7rem] ${active ? 'text-[#14161a]' : 'text-accent'}`}>{strings.split('').join('·')}</div>
            <div className={`text-[.62rem] ${active ? 'text-[#14161a]' : 'text-dim'}`}>{fingers}</div>
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

export function RhythmCard({ rhythm, selected, playing = false, onSelect }: {
  rhythm: Rhythm
  selected: boolean
  /** selecionado E com o metrônomo tocando agora — visual diferente de só "escolhido" */
  playing?: boolean
  onSelect: () => void
}) {
  const stateClass = playing
    ? 'border-accent2 bg-[color-mix(in_srgb,var(--accent2)_14%,var(--bg3))]'
    : selected
      ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg3))]'
      : 'border-line bg-bg3'

  return (
    <button className={`border rounded-[9px] p-[.55rem_.65rem] text-left flex flex-col gap-1.5 ${stateClass}`} onClick={onSelect}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {playing && <PlayIcon className="text-accent2 w-3 h-3 flex-none" aria-label="Tocando agora" />}
        <span className="text-[.85rem] font-semibold">{rhythm.name}</span>
        <span className="text-[.65rem] border border-line rounded px-[.3rem] text-dim">{rhythm.meter}</span>
      </div>
      <RhythmGrid rhythm={rhythm} />
      <div className="flex flex-wrap gap-1">
        {rhythm.genres.map((g) => (
          <span key={g} className={`text-[.64rem] rounded px-[.35rem] py-[.05rem] border bg-bg2 ${genreColorClass(g)}`}>{g}</span>
        ))}
      </div>
      {rhythm.hint && <div className="text-[.7rem] text-dim italic">{rhythm.hint}</div>}
    </button>
  )
}
