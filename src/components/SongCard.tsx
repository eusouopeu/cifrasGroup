import { useRef, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon, EllipsisVerticalIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { Song } from '../store/db'

/** largura da faixa de ações (duplicar/apagar) escondida atrás do card */
const REVEAL_WIDTH = 88
/** arrasto mínimo para considerar "abrir" ao soltar, em vez de voltar pro lugar */
const SWIPE_THRESHOLD = 36

export function SongCard({ song, onOpen, onDelete, onDuplicate, deleteLabel = 'apagar', onMoveUp, onMoveDown, showChords = true }: {
  song: Song
  onOpen: () => void
  onDelete: () => void
  onDuplicate: () => void
  deleteLabel?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** prévia dos acordes mais usados — só faz sentido onde o repertório importa (Listas), não na busca geral (Início) */
  showChords?: boolean
}) {
  const chords = song.meta.topChords
  const s = song.settings
  // ordem de prioridade: o que mais muda a leitura da cifra vem primeiro
  const badges: string[] = []
  if (s.simplifyLevel > 0) badges.push(`nível ${s.simplifyLevel}`)
  if (s.transpose !== 0) badges.push(`${s.transpose > 0 ? '+' : ''}${s.transpose}`)
  if (s.capo > 0) badges.push(`capo ${s.capo}`)
  if (s.paletteId !== 'original') badges.push(s.paletteId)
  if (s.rhythmId) badges.push(s.rhythmId)
  if (s.scrollSpeed > 0) badges.push(`rolagem ${s.scrollSpeed}`)
  const VISIBLE_BADGES = 3
  const visibleBadges = badges.slice(0, VISIBLE_BADGES)
  const hiddenCount = badges.length - visibleBadges.length

  // duplicar/apagar ficam escondidos atrás do card, revelados arrastando (ou
  // pelo botão "mais opções", alternativa sem gesto pra quem usa teclado/mouse)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragBaseX = useRef(0)
  const moved = useRef(false)
  const pointerActive = useRef(false)

  const setRevealed = (open: boolean) => setX(open ? -REVEAL_WIDTH : 0)

  // só passa a capturar o ponteiro (e a virar "arrasto") depois de um deslocamento
  // mínimo — senão um botão dentro do card (duplicar, apagar, abrir) nunca recebe o clique
  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX
    dragBaseX.current = x
    moved.current = false
    pointerActive.current = true
    setDragging(false)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerActive.current) return
    const delta = e.clientX - dragStartX.current
    if (!dragging) {
      if (Math.abs(delta) < 6) return
      moved.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setX(Math.min(0, Math.max(-REVEAL_WIDTH, dragBaseX.current + delta)))
  }
  const endDrag = () => {
    pointerActive.current = false
    if (!dragging) return
    setDragging(false)
    setRevealed(x <= -SWIPE_THRESHOLD)
  }

  return (
    <div className="relative overflow-hidden rounded-[10px]">
      <div
        className={`absolute inset-y-0 right-0 flex flex-col gap-1.5 items-center justify-center px-2 ${x === 0 ? 'invisible' : ''}`}
        style={{ width: REVEAL_WIDTH }}
        aria-hidden={x === 0}
      >
        <button
          className="icon text-[1.05rem] leading-none p-0 w-8 h-8 flex items-center justify-center text-blue"
          tabIndex={x === 0 ? -1 : 0}
          onClick={() => { onDuplicate(); setRevealed(false) }}
          aria-label="Duplicar música"
          title="Duplicar"
        >
          <DocumentDuplicateIcon />
        </button>
        <button
          className="icon text-[1.05rem] leading-none p-0 w-8 h-8 flex items-center justify-center text-danger"
          tabIndex={x === 0 ? -1 : 0}
          onClick={() => { onDelete(); setRevealed(false) }}
          aria-label={deleteLabel === 'apagar' ? 'Apagar música' : deleteLabel}
          title={deleteLabel}
        >
          <TrashIcon />
        </button>
      </div>

      <div
        className="relative bg-bg2 border border-line rounded-[10px] p-[.6rem_.7rem] flex flex-col gap-1.5 max-[620px]:flex-row max-[620px]:items-center max-[620px]:justify-between max-[620px]:p-[.7rem_.8rem] touch-pan-y"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform .2s ease' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button
          className="bg-none border-0 text-left p-0 flex flex-col gap-1 max-[620px]:flex-1 max-[620px]:min-w-0"
          onClick={() => { if (x !== 0) { setRevealed(false); return } if (!moved.current) onOpen() }}
        >
          <strong>{song.title}</strong>
          {song.artist && <span className="text-dim text-[.8rem]">{song.artist}</span>}
          {showChords && <span className="mono text-accent2 text-[.78rem]">{chords.join(' ')}</span>}
          <span className="flex flex-wrap gap-1">
            {visibleBadges.map((b) => <i key={b} className="not-italic text-[.68rem] bg-bg3 border border-line rounded text-dim px-1.5">{b}</i>)}
            {hiddenCount > 0 && (
              <i className="not-italic text-[.68rem] bg-bg3 border border-line rounded px-1.5 text-accent2 border-accent2 cursor-default" title={badges.slice(VISIBLE_BADGES).join(', ')}>
                +{hiddenCount}
              </i>
            )}
          </span>
        </button>
        <div className="flex gap-2 self-end items-center">
          {(onMoveUp || onMoveDown) && (
            <span className="flex [&_.icon:disabled]:opacity-30">
              <button className="icon small" disabled={!onMoveUp} onClick={onMoveUp} aria-label="Mover para cima"><ChevronUpIcon /></button>
              <button className="icon small" disabled={!onMoveDown} onClick={onMoveDown} aria-label="Mover para baixo"><ChevronDownIcon /></button>
            </span>
          )}
          <button
            className="icon small"
            aria-label="Mais opções (duplicar, apagar)"
            aria-expanded={x !== 0}
            onClick={() => setRevealed(x === 0)}
          >
            <EllipsisVerticalIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
