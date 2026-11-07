import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Bars2Icon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, PlusIcon, RectangleStackIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { DB, Song, SongList } from '../store/db'
import { LIST_SORT_LABEL, orderedListSongIds, type ListSort } from '../store/listOrder'
import { Ajuda } from './Ajuda'
import { MedleySheet } from './MedleySheet'
import { SongCard } from './SongCard'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { ThemeToggleButton } from './ThemeControls'

export function ListsView({ db, onOpen, onCreateList, onDeleteList, onRemoveFromList, onDuplicateSong, onMoveSong, onSetSort, onCreateMedley }: {
  db: DB
  onOpen: (id: string, listId?: string) => void
  onCreateList: (name: string) => void
  onDeleteList: (id: string) => void
  onRemoveFromList: (listId: string, songId: string) => void
  onDuplicateSong: (id: string) => void
  /** coloca a música na posição `toIndex` da lista (ordem do repertório) */
  onMoveSong: (listId: string, songId: string, toIndex: number) => void
  onSetSort: (listId: string, sort: ListSort) => void
  /** cria a música do medley e a acrescenta no fim da lista */
  onCreateMedley: (listId: string, title: string, artist: string, raw: string) => void
}) {
  const [newList, setNewList] = useState('')

  return (
    <div className="library">
      <header className="apphead">
        <h1>Listas</h1>
        <FontSizeToggleButton />
        <InstrumentToggleButton />
        <ThemeToggleButton />
      </header>

      {db.lists.map((list) => (
        <ListSection
          key={list.id}
          list={list}
          db={db}
          onOpen={onOpen}
          onDeleteList={onDeleteList}
          onRemoveFromList={onRemoveFromList}
          onDuplicateSong={onDuplicateSong}
          onMoveSong={onMoveSong}
          onSetSort={onSetSort}
          onCreateMedley={onCreateMedley}
        />
      ))}

      <div className="newlist">
        <input aria-label="Nome da nova lista" placeholder="Nova lista (ex.: Roda de violão)" value={newList} onChange={(e) => setNewList(e.target.value)} />
        <button
          className="icon"
          disabled={!newList.trim()}
          onClick={() => { onCreateList(newList.trim()); setNewList('') }}
          aria-label="Criar lista"
          title="Criar lista"
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}

const SORTS: ListSort[] = ['manual', 'oldest', 'newest', 'title']

function ListSection({ list, db, onOpen, onDeleteList, onRemoveFromList, onDuplicateSong, onMoveSong, onSetSort, onCreateMedley }: {
  list: SongList
  db: DB
  onOpen: (id: string, listId?: string) => void
  onDeleteList: (id: string) => void
  onRemoveFromList: (listId: string, songId: string) => void
  onDuplicateSong: (id: string) => void
  onMoveSong: (listId: string, songId: string, toIndex: number) => void
  onSetSort: (listId: string, sort: ListSort) => void
  onCreateMedley: (listId: string, title: string, artist: string, raw: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [medleyOpen, setMedleyOpen] = useState(false)
  const sort = list.sort ?? 'manual'
  const manual = sort === 'manual'
  const songs = orderedListSongIds(list, db.songs).map((id) => db.songs[id])
  const drag = useDragReorder(songs, (id, to) => onMoveSong(list.id, id, to))
  // tocar na alça sem arrastar mostra ↑/↓ naquele card: alternativa de toque
  // simples ao gesto de arrastar (e o teclado usa as setas na própria alça)
  const [pickedId, setPickedId] = useState<string | null>(null)

  return (
    <section className="mt-5">
      <div className="flex items-center gap-1">
        <button
          className="bg-none border-0 text-[.95rem] font-semibold py-1.5 inline-flex items-center gap-1.5 [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:flex-shrink-0"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />} {list.name} <span className="count">{songs.length}</span>
        </button>
        {songs.length > 1 && (
          <Ajuda label="Sobre a ordem da lista">
            “Repertório” é a ordem que você monta: arraste pela alça ≡ para reorganizar — ou toque nela e use ↑/↓.
            As outras ordens só mudam a exibição, sem perder a do repertório.
            Abrindo uma música daqui, dá para passar para a anterior e a próxima na ordem exibida.
          </Ajuda>
        )}
        <span className="flex-1" />
        {songs.length > 1 && (
          <button className="icon small" aria-label={`Criar medley com músicas de ${list.name}`} title="Criar medley" onClick={() => setMedleyOpen(true)}>
            <RectangleStackIcon />
          </button>
        )}
        <button className="icon small danger" aria-label={`Apagar a lista ${list.name}`} title="Apagar lista" onClick={() => onDeleteList(list.id)}>
          <TrashIcon />
        </button>
      </div>
      {open && songs.length > 1 && (
        <div className="toggle flex w-full mt-1.5 [&>button]:flex-1 [&>button]:!px-1.5" role="group" aria-label={`Ordem da lista ${list.name}`}>
          {SORTS.map((id) => (
            <button key={id} className={sort === id ? 'on' : ''} aria-pressed={sort === id} onClick={() => onSetSort(list.id, id)}>
              {LIST_SORT_LABEL[id]}
            </button>
          ))}
        </div>
      )}
      {open && songs.length > 0 && (
        <div ref={drag.containerRef} className="relative grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))] mt-2 max-[620px]:grid-cols-1">
          {songs.map((s, i) => {
            const dragging = drag.dragId === s.id
            return (
              <div
                key={s.id}
                data-song-id={s.id}
                className={dragging ? 'relative z-10 rounded-[10px] shadow-[0_10px_28px_rgba(0,0,0,.28)]' : 'transition-transform duration-150'}
                style={dragging ? { transform: `translate(${drag.offset.x}px, ${drag.offset.y}px)` } : undefined}
              >
                <SongCard
                  song={s}
                  onOpen={() => onOpen(s.id, list.id)}
                  onDelete={() => onRemoveFromList(list.id, s.id)}
                  deleteLabel="tirar da lista"
                  onDuplicate={() => onDuplicateSong(s.id)}
                  actions={manual && songs.length > 1 && (
                    <>
                      {pickedId === s.id && (
                        <span className="flex animate-surge [&_.icon:disabled]:opacity-30">
                          <button className="icon small" disabled={i === 0} onClick={() => onMoveSong(list.id, s.id, i - 1)} aria-label="Mover para cima"><ChevronUpIcon /></button>
                          <button className="icon small" disabled={i === songs.length - 1} onClick={() => onMoveSong(list.id, s.id, i + 1)} aria-label="Mover para baixo"><ChevronDownIcon /></button>
                        </span>
                      )}
                      <button
                        className={`icon small touch-none cursor-grab${pickedId === s.id ? ' active' : ''}`}
                        aria-label={`Reordenar ${s.title} (arraste, ou use as setas do teclado)`}
                        title="Arraste para reordenar"
                        aria-pressed={pickedId === s.id}
                        onPointerDown={(e) => drag.start(e, s.id)}
                        onClick={() => { if (!drag.consumeMoved()) setPickedId(pickedId === s.id ? null : s.id) }}
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); onMoveSong(list.id, s.id, i - 1) }
                          if (e.key === 'ArrowDown' && i < songs.length - 1) { e.preventDefault(); onMoveSong(list.id, s.id, i + 1) }
                        }}
                      >
                        <Bars2Icon />
                      </button>
                    </>
                  )}
                />
              </div>
            )
          })}
        </div>
      )}
      {medleyOpen && (
        <MedleySheet
          songs={songs}
          onClose={() => setMedleyOpen(false)}
          onCreate={(title, artist, raw) => { onCreateMedley(list.id, title, artist, raw); setMedleyOpen(false) }}
        />
      )}
    </section>
  )
}

/**
 * Arrastar para reordenar com troca ao vivo: quando o dedo entra na área de
 * outro card, a música muda de posição na hora e o card arrastado continua
 * colado ao dedo (o deslocamento é recalculado a partir da posição natural
 * dele no grid, que muda a cada troca). Funciona tanto na coluna única do
 * celular quanto no grid de várias colunas.
 */
function useDragReorder(songs: Song[], onMove: (id: string, toIndex: number) => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const grab = useRef({ x: 0, y: 0 })
  const moved = useRef(false)
  const songsRef = useRef(songs)
  songsRef.current = songs

  const itemEl = (id: string) => containerRef.current?.querySelector<HTMLElement>(`[data-song-id="${id}"]`) ?? null

  const start = (e: ReactPointerEvent, id: string) => {
    // a alça vive dentro do card que também desliza para o lado (SongCard):
    // sem isso o gesto de revelar duplicar/apagar disputaria o mesmo toque
    e.stopPropagation()
    const el = itemEl(id)
    if (!el) return
    // ouvintes na janela, não na alça: a troca de posição move o card no DOM e
    // isso derruba a captura do ponteiro — o "soltar" nunca chegava e o card
    // ficava preso no ar
    const pointerId = e.pointerId
    // ponto do card onde o dedo pegou, em coordenadas do grid
    grab.current = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop }
    moved.current = false
    const startX = e.clientX
    const startY = e.clientY
    let active = false
    let ended = false

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
        active = true
        moved.current = true
        setDragId(id)
      }
      ev.preventDefault()
      const self = itemEl(id)
      if (!self) return
      const list = songsRef.current
      const from = list.findIndex((s) => s.id === id)
      for (let i = 0; i < list.length; i++) {
        if (i === from) continue
        const r = itemEl(list[i].id)?.getBoundingClientRect()
        if (r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          onMove(id, i)
          break
        }
      }
      // posição natural lida de novo no próximo quadro, depois da troca renderizar
      requestAnimationFrame(() => {
        if (ended) return
        const node = itemEl(id)
        if (node) setOffset({ x: ev.clientX - grab.current.x - node.offsetLeft, y: ev.clientY - grab.current.y - node.offsetTop })
      })
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      ended = true
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setDragId(null)
      setOffset({ x: 0, y: 0 })
    }
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  /** true se o último toque na alça foi um arrasto (aí o clique que vem junto é ignorado) */
  const consumeMoved = () => {
    const was = moved.current
    moved.current = false
    return was
  }

  return { containerRef, dragId, offset, start, consumeMoved }
}
