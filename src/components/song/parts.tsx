/** Peças pequenas e sem lógica da tela da música. */
import { useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { FONT_SIZES, fontSizeLabelFor, type FontSizeLabel } from '../../store/songActions'

/** Tamanho do texto em quatro passos (P/M/G/GG) em vez de um valor livre em px. */
export function SizePicker({ value, onChange }: { value: number; onChange: (px: number) => void }) {
  const current = fontSizeLabelFor(value)
  return (
    <div className="toggle sizepicker">
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
    <button className={`tool${active ? ' active' : ''}${flash ? ' flash' : ''}`} onClick={onClick} aria-pressed={active}>
      <span className="tool-label">{label}</span>
      <span className="tool-value">{value}</span>
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
      <h3 className="panel-title-row">
        <span>{title}</span>
        {headerExtra && <span className="panel-title-extra">{headerExtra}</span>}
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
    <button className={`level${active ? ' selected' : ''}`} onClick={onClick} aria-pressed={active}>
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
    <div className="tageditor">
      <div className="tagchips">
        {tags.map((t) => (
          <span key={t} className="tagchip">
            {t}
            <button className="tagchip-remove" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remover tag ${t}`}><XMarkIcon /></button>
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
      className="songhead-title songhead-title-edit"
      ref={boxRef}
      // só confirma quando o foco sai dos dois campos (não a cada troca entre eles)
      onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget as Node)) commit() }}
    >
      <input className="mono" aria-label="Título" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} autoFocus placeholder="título" />
      <input aria-label="Artista" value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="artista" />
    </div>
  )
}
