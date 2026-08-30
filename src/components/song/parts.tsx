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
