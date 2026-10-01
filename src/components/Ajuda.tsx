/**
 * Ajuda recolhida (../_shared/design-standards.md, "Ajuda e explicações"):
 * a explicação de como algo funciona vive atrás de um ⓘ posto AO LADO do
 * texto a que se refere e abre num balão flutuante — não empurra o layout
 * nem fica impressa na tela o tempo todo. Fecha com outro toque, toque fora,
 * Esc ou rolagem. O balão vai para o <body> (portal) para não ser cortado por
 * contêiner com overflow escondido, e fica preso a 12px das bordas da tela.
 *
 * Mesmo comportamento do `Ajuda` do rotinas, adaptado aos tokens deste app.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

const MARGIN = 12
const WIDTH = 280

export function Ajuda({ children, label = 'Como funciona', className = '' }: {
  children: ReactNode
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(WIDTH, vw - MARGIN * 2)
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - width / 2), vw - MARGIN - width)
    const height = bubble.current?.offsetHeight || 80
    const above = r.bottom + 6 + height > vh - MARGIN && r.top - 6 - height > MARGIN
    setPos({ left, top: above ? r.top - 6 - height : r.bottom + 6, above })
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!bubble.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <span className={`inline-flex align-middle ${className}`}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPos(null)
          setOpen(!open)
        }}
        className={`-my-1.5 inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent transition-[color,transform] duration-150 active:scale-90 [&>svg]:w-[17px] [&>svg]:h-[17px] ${open ? 'text-accent' : 'text-dim'}`}
      >
        <InformationCircleIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={bubble}
            role="tooltip"
            className={`fixed z-[60] rounded-[10px] bg-fg text-bg px-3 py-2.5 font-sans text-[.82rem] leading-[1.5] font-normal normal-case tracking-normal shadow-[0_8px_24px_rgba(0,0,0,.22)] ${pos ? 'animate-surge' : 'invisible'} ${pos?.above ? 'origin-bottom' : 'origin-top'}`}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: Math.min(WIDTH, window.innerWidth - MARGIN * 2) }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  )
}
