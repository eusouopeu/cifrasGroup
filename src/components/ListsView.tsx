import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { DB, SongList } from '../store/db'
import { SongCard } from './SongCard'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { ThemeToggleButton } from './ThemeControls'

export function ListsView({ db, onOpen, onCreateList, onDeleteList, onRemoveFromList, onDuplicateSong, onReorderSong }: {
  db: DB
  onOpen: (id: string, listId?: string) => void
  onCreateList: (name: string) => void
  onDeleteList: (id: string) => void
  onRemoveFromList: (listId: string, songId: string) => void
  onDuplicateSong: (id: string) => void
  onReorderSong: (listId: string, songId: string, dir: 'up' | 'down') => void
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
          onReorderSong={onReorderSong}
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

function ListSection({ list, db, onOpen, onDeleteList, onRemoveFromList, onDuplicateSong, onReorderSong }: {
  list: SongList
  db: DB
  onOpen: (id: string, listId?: string) => void
  onDeleteList: (id: string) => void
  onRemoveFromList: (listId: string, songId: string) => void
  onDuplicateSong: (id: string) => void
  onReorderSong: (listId: string, songId: string, dir: 'up' | 'down') => void
}) {
  const [open, setOpen] = useState(true)
  const songs = list.songIds.map((id) => db.songs[id]).filter(Boolean)
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between">
        <button
          className="bg-none border-0 text-[.95rem] font-semibold py-1.5 inline-flex items-center gap-1.5 [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:flex-shrink-0"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />} {list.name} <span className="count">{songs.length}</span>
        </button>
        <button className="icon small" aria-label={`Apagar a lista ${list.name}`} onClick={() => onDeleteList(list.id)}>apagar</button>
      </div>
      {open && (
        songs.length === 0
          ? null
          : <>
              {songs.length > 1 && <p className="hint small">A ordem aqui é a ordem do repertório: use as setas para reorganizar e abra qualquer música para navegar pelas outras da lista sem voltar aqui.</p>}
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))] mt-2 max-[620px]:grid-cols-1">
                {songs.map((s, i) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    onOpen={() => onOpen(s.id, list.id)}
                    onDelete={() => onRemoveFromList(list.id, s.id)}
                    deleteLabel="tirar da lista"
                    onDuplicate={() => onDuplicateSong(s.id)}
                    onMoveUp={i > 0 ? () => onReorderSong(list.id, s.id, 'up') : undefined}
                    onMoveDown={i < songs.length - 1 ? () => onReorderSong(list.id, s.id, 'down') : undefined}
                  />
                ))}
              </div>
            </>
      )}
    </section>
  )
}
