/** Peças pequenas e sem lógica da tela da música. */
import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { FONT_SIZES, fontSizeLabelFor, type FontSizeLabel } from '../../store/songActions'

/** Tamanho do texto em quatro passos (P/M/G/GG) em vez de um valor livre em px. */
export function SizePicker({ value, onChange }: { value: number; onChange: (px: number) => void }) {
  const current = fontSizeLabelFor(value)
  return (
    <div className="toggle">
      {(Object.keys(FONT_SIZES) as FontSizeLabel[]).map((label) => (
        <button key={label} className={current === label ? 'on' : ''} onClick={() => onChange(FONT_SIZES[label])} aria-pressed={current === label}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function ToolButton({ label, value, active, onClick, flash }: {
  label: string
  value: string
  active: boolean
  onClick: () => void
  flash?: boolean
}) {
  return (
    <button
      className={`flex-none border rounded-lg p-[.3rem_.6rem] flex flex-col items-start leading-[1.2] max-[620px]:min-h-[42px] max-[620px]:justify-center ${
        active ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg3))]' : 'border-line bg-bg3'
      }${flash ? ' animate-tool-flash' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="text-[.66rem] uppercase tracking-[.05em] text-dim">{label}</span>
      <span className="text-[.8rem]">{value}</span>
    </button>
  )
}

/**
 * Botões redondos da barra de transporte (rodapé da tela da música) e a
 * própria barra.
 *
 * As três variantes de tamanho e o estado "ligado" estavam escritos à mão em
 * utilities Tailwind, com todas as variantes `max-[620px]:`, repetidos em
 * cinco botões e duas barras dentro de SongView.tsx — qualquer ajuste de
 * tamanho ou de cor tinha de ser refeito em cada cópia, e uma cópia sempre
 * ficava para trás.
 */
const TRANSPORT_SIZES = {
  sm: 'w-[34px] h-[34px] [&>svg]:w-4 [&>svg]:h-4 max-[620px]:w-[30px] max-[620px]:h-[30px] max-[620px]:[&>svg]:w-3.5 max-[620px]:[&>svg]:h-3.5',
  md: 'w-[42px] h-[42px] [&>svg]:w-[19px] [&>svg]:h-[19px] max-[620px]:w-[38px] max-[620px]:h-[38px] max-[620px]:[&>svg]:w-[17px] max-[620px]:[&>svg]:h-[17px]',
  lg: 'w-[52px] h-[52px] [&>svg]:w-[22px] [&>svg]:h-[22px] max-[620px]:w-[46px] max-[620px]:h-[46px] max-[620px]:[&>svg]:w-5 max-[620px]:[&>svg]:h-5',
} as const

export type TransportSize = keyof typeof TRANSPORT_SIZES

export function TransportButton({ size = 'md', active = false, filled = false, onClick, label, title, children }: {
  size?: TransportSize
  /** destacado em cor de acento, com fundo suave — botão de alternância ligado */
  active?: boolean
  /** botão principal em acento sólido (o play/parar do metrônomo) */
  filled?: boolean
  onClick: () => void
  label: string
  title?: string
  children: React.ReactNode
}) {
  const tone = filled
    ? 'bg-accent border-accent text-[#14161a]'
    : active
      ? 'bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg3))] border-accent text-accent'
      : 'border-line bg-bg3 text-dim'
  return (
    <button
      className={`flex-none rounded-full border grid place-items-center p-0 ${TRANSPORT_SIZES[size]} ${tone}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={filled ? undefined : active}
      title={title ?? label}
    >
      {children}
    </button>
  )
}

/** Barra fixa no rodapé, ao alcance do polegar. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-[5] flex items-center justify-between gap-[.7rem] py-2 px-[.7rem] pb-[calc(.5rem+env(safe-area-inset-bottom))] bg-bg2 border-t border-line shadow-[0_-4px_16px_rgba(0,0,0,.18)] max-[620px]:gap-[.35rem] max-[620px]:p-[.4rem_.4rem_calc(.4rem+env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

/** Faixa fina acima da barra de transporte (rolagem, grade da batida). */
export function StripBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-[6] flex items-center gap-2 py-1.5 px-[.6rem] bg-bg3 border-t border-line overflow-hidden">
      {children}
    </div>
  )
}

export function Panel({ title, headerExtra, children }: {
  title: string
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="panel">
      <h3 className="inline-flex items-center gap-2">
        <span>{title}</span>
        {headerExtra && <span className="inline-flex [&>.icon]:p-0">{headerExtra}</span>}
      </h3>
      {children}
    </section>
  )
}

export function LevelButton({ active, onClick, title, desc }: {
  active: boolean
  onClick: () => void
  title: string
  desc: string
}) {
  return (
    <button
      className={`bg-bg3 border rounded-[9px] p-[.55rem_.7rem] text-left flex flex-col gap-[.2rem] [&>span]:text-[.74rem] [&>span]:text-dim ${
        active ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg3))]' : 'border-line'
      }`}
      onClick={onClick}
      aria-pressed={active}
    >
      <strong>{title}</strong>
      <span>{desc}</span>
    </button>
  )
}

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const t = input.trim().toLowerCase()
    if (!t || tags.includes(t)) { setInput(''); return }
    onChange([...tags, t])
    setInput('')
  }
  return (
    <div className="mb-3 [&_input]:flex-1 [&_input]:bg-bg2 [&_input]:border [&_input]:border-line [&_input]:rounded-lg [&_input]:text-fg [&_input]:p-[.45rem_.6rem] [&_input]:text-[.85rem]">
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 bg-bg3 border border-line rounded-full p-[.2rem_.3rem_.2rem_.6rem] text-[.78rem]">
            {t}
            <button
              className="bg-none border-0 text-dim text-[.9rem] px-[.3rem] leading-none inline-flex items-center hover:text-danger [&>svg]:w-3 [&>svg]:h-3"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              aria-label={`Remover tag ${t}`}
            >
              <X />
            </button>
          </span>
        ))}
      </div>
      <div className="row tight">
        <input
          placeholder="nova tag"
          aria-label="Nova tag"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
        />
        <button className="btn" disabled={!input.trim()} onClick={addTag}>adicionar</button>
      </div>
    </div>
  )
}

export function EditTitle({ title, artist, onDone }: {
  title: string
  artist: string
  onDone: (title: string, artist: string) => void
}) {
  const [t, setT] = useState(title)
  const [a, setA] = useState(artist)
  const boxRef = useRef<HTMLDivElement>(null)
  const commit = () => onDone(t.trim() || title, a.trim())
  return (
    <div
      className="flex-1 flex flex-row min-w-0 leading-[1.15] gap-[.35rem] cursor-default [&_input]:flex-1 [&_input]:min-w-0 [&_input]:bg-bg3 [&_input]:border [&_input]:border-line [&_input]:rounded-md [&_input]:text-fg [&_input]:text-[.85rem] [&_input]:p-[.3rem_.4rem]"
      ref={boxRef}
      // só confirma quando o foco sai dos dois campos (não a cada troca entre eles)
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget as Node)) commit() }}
    >
      <input className="mono" aria-label="Título" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} autoFocus placeholder="título" />
      <input aria-label="Artista" value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="artista" />
    </div>
  )
}
