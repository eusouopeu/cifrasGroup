import { useMemo, useState } from 'react'
import { Filter, Plus, X } from 'lucide-react'
import type { DB } from '../store/db'
import type { Difficulty } from '../cifra/meta'
import { rhythmById } from '../data/rhythms'
import { SongCard } from './SongCard'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { ThemeToggleButton } from './ThemeControls'

type SortBy = 'recente' | 'menosPraticadas' | 'semTocar'

export function LibraryHome({ db, onOpen, onNew, onDeleteSong, onDuplicateSong }: {
  db: DB
  onOpen: (id: string, listId?: string) => void
  onNew: () => void
  onDeleteSong: (id: string) => void
  onDuplicateSong: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [maxChordsFilter, setMaxChordsFilter] = useState<number | ''>('')
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | null>(null)
  const [genreFilter, setGenreFilter] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('recente')

  const songs = useMemo(() => {
    const list = Object.values(db.songs)
    switch (sortBy) {
      case 'menosPraticadas':
        return list.sort((a, b) => a.practice.count - b.practice.count || b.updatedAt - a.updatedAt)
      case 'semTocar':
        return list.sort((a, b) => (a.practice.lastPlayedAt ?? 0) - (b.practice.lastPlayedAt ?? 0))
      default:
        return list.sort((a, b) => b.updatedAt - a.updatedAt)
    }
  }, [db.songs, sortBy])

  // gênero é o único filtro que ainda depende de olhar cada música (via o
  // ritmo escolhido) — dificuldade e nº de acordes já vêm prontos em song.meta
  const genresBySong = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of songs) map.set(s.id, rhythmById(s.settings.rhythmId)?.genres ?? [])
    return map
  }, [songs])

  const allTags = useMemo(() => [...new Set(songs.flatMap((s) => s.tags))].sort(), [songs])
  const usedGenres = useMemo(() => [...new Set([...genresBySong.values()].flat())].sort(), [genresBySong])

  const hasActiveFilters = tagFilter !== null || maxChordsFilter !== '' || difficultyFilter !== null || genreFilter.size > 0

  const filtered = songs.filter((s) => {
    if (query && !(s.title + ' ' + s.artist).toLowerCase().includes(query.toLowerCase())) return false
    if (tagFilter !== null && !s.tags.includes(tagFilter)) return false
    if (maxChordsFilter !== '' && s.meta.chordCount > maxChordsFilter) return false
    if (difficultyFilter !== null && s.meta.difficulty !== difficultyFilter) return false
    if (genreFilter.size > 0 && !(genresBySong.get(s.id) ?? []).some((g) => genreFilter.has(g))) return false
    return true
  })

  const toggleGenre = (g: string) => {
    setGenreFilter((cur) => {
      const next = new Set(cur)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const clearFilters = () => { setTagFilter(null); setMaxChordsFilter(''); setDifficultyFilter(null); setGenreFilter(new Set()) }
  const clearSearchAndFilters = () => { setQuery(''); clearFilters() }

  return (
    <div className="library">
      <header className="apphead">
        <h1>cifras<span className="text-accent">Group</span></h1>
        <FontSizeToggleButton />
        <InstrumentToggleButton />
        <ThemeToggleButton />
      </header>

      <div className="flex items-center gap-2 mt-2.5">
        <input className="search flex-1" aria-label="Buscar por título ou artista" placeholder="Buscar por título ou artista" value={query} onChange={(e) => setQuery(e.target.value)} />
        {songs.length > 1 && (
          <select
            className="bg-bg2 border border-line rounded-lg text-fg px-2 py-1.5 text-[.8rem] flex-shrink-0"
            aria-label="Ordenar biblioteca"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="recente">recentes</option>
            <option value="menosPraticadas">menos praticadas</option>
            <option value="semTocar">sem tocar há mais tempo</option>
          </select>
        )}
        {songs.length > 0 && (
          <button
            className={`icon relative flex-shrink-0${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filtros"
            title="Filtros"
          >
            <Filter />
            {hasActiveFilters && !filtersOpen && <span className="absolute top-[2px] right-[2px] w-[7px] h-[7px] rounded-full bg-accent" />}
          </button>
        )}
      </div>

      {filtersOpen && songs.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 my-2.5 items-center">
            <label className="flex items-center gap-1.5 text-[.8rem] text-dim">
              Acordes:
              <input
                type="number"
                min={0}
                placeholder="até"
                className="numinput small bg-bg2 border border-line rounded-lg text-fg px-2.5 py-1.5 text-[.8rem]"
                value={maxChordsFilter}
                onChange={(e) => setMaxChordsFilter(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[.8rem] text-dim">
              Dificuldade:
              <select
                className="bg-bg2 border border-line rounded-lg text-fg px-2.5 py-1.5 text-[.8rem]"
                value={difficultyFilter ?? ''}
                onChange={(e) => setDifficultyFilter(e.target.value === '' ? null : (e.target.value as Difficulty))}
              >
                <option value="">qualquer</option>
                <option value="fácil">fácil</option>
                <option value="médio">médio</option>
                <option value="difícil">difícil</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button className="icon small" onClick={clearFilters} aria-label="Limpar filtros" title="Limpar filtros">
                <X />
              </button>
            )}
          </div>

          {usedGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {usedGenres.map((g) => (
                <button
                  key={g}
                  className={`chip${genreFilter.has(g) ? ' on' : ''}`}
                  aria-pressed={genreFilter.has(g)}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {allTags.length > 0 && (
            <div className="tagchips -mt-0.5 mb-3">
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`tagchip cursor-pointer${tagFilter === t ? ' on' : ''}`}
                  aria-pressed={tagFilter === t}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {songs.length === 0 && <p className="hint">Nada aqui ainda. Importe uma cifra para começar.</p>}
      {songs.length > 0 && filtered.length === 0 && (
        <p className="hint">
          Nenhuma música encontrada com esse termo/filtros.{' '}
          <button className="icon small" onClick={clearSearchAndFilters}>limpar busca e filtros</button>
        </p>
      )}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))] mt-2 max-[620px]:grid-cols-1">
        {filtered.map((s) => (
          <SongCard key={s.id} song={s} onOpen={() => onOpen(s.id)} onDelete={() => onDeleteSong(s.id)} onDuplicate={() => onDuplicateSong(s.id)} showChords={false} />
        ))}
      </div>

      <button
        className="fixed right-[1.1rem] bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-[6] w-14 h-14 rounded-full bg-accent text-[#14161a] border-0 grid place-items-center shadow-[0_4px_14px_rgba(0,0,0,.3)] [&>svg]:w-[26px] [&>svg]:h-[26px]"
        onClick={onNew}
        aria-label="Importar cifra"
        title="Importar cifra"
      >
        <Plus />
      </button>
    </div>
  )
}
