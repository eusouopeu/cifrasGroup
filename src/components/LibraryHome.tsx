import { useMemo, useState } from 'react'
import { FunnelIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { DB } from '../store/db'
import type { Difficulty } from '../cifra/meta'
import { rhythmById } from '../data/rhythms'
import { SongCard } from './SongCard'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { ThemeToggleButton } from './ThemeControls'

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

  const songs = useMemo(() => Object.values(db.songs).sort((a, b) => b.updatedAt - a.updatedAt), [db.songs])

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

  return (
    <div className="library">
      <header className="apphead">
        <h1>cifras<span>Group</span></h1>
        <FontSizeToggleButton />
        <InstrumentToggleButton />
        <ThemeToggleButton />
      </header>

      <div className="searchrow">
        <input className="search" aria-label="Buscar por título ou artista" placeholder="Buscar por título ou artista" value={query} onChange={(e) => setQuery(e.target.value)} />
        {songs.length > 0 && (
          <button
            className={`icon${filtersOpen ? ' active' : ''}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filtros"
            title="Filtros"
          >
            <FunnelIcon />
            {hasActiveFilters && !filtersOpen && <span className="filter-dot" />}
          </button>
        )}
      </div>

      {filtersOpen && songs.length > 0 && (
        <>
          <div className="filterbar">
            <label className="filterfield">
              Acordes:
              <input
                type="number"
                min={0}
                placeholder="até"
                className="numinput small"
                value={maxChordsFilter}
                onChange={(e) => setMaxChordsFilter(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="filterfield">
              Dificuldade:
              <select value={difficultyFilter ?? ''} onChange={(e) => setDifficultyFilter(e.target.value === '' ? null : (e.target.value as Difficulty))}>
                <option value="">qualquer</option>
                <option value="fácil">fácil</option>
                <option value="médio">médio</option>
                <option value="difícil">difícil</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button className="icon small" onClick={clearFilters} aria-label="Limpar filtros" title="Limpar filtros">
                <XMarkIcon />
              </button>
            )}
          </div>

          {usedGenres.length > 0 && (
            <div className="genrefilter">
              {usedGenres.map((g) => (
                <button key={g} className={`genrechip${genreFilter.has(g) ? ' on' : ''}`} aria-pressed={genreFilter.has(g)} onClick={() => toggleGenre(g)}>
                  {g}
                </button>
              ))}
            </div>
          )}

          {allTags.length > 0 && (
            <div className="tagchips filterbar-tags">
              {allTags.map((t) => (
                <button key={t} className={`tagchip filterchip${tagFilter === t ? ' on' : ''}`} aria-pressed={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {filtered.length === 0 && <p className="hint">Nada aqui ainda. Importe uma cifra para começar.</p>}
      <div className="songgrid">
        {filtered.map((s) => (
          <SongCard key={s.id} song={s} onOpen={() => onOpen(s.id)} onDelete={() => onDeleteSong(s.id)} onDuplicate={() => onDuplicateSong(s.id)} />
        ))}
      </div>

      <button className="fab" onClick={onNew} aria-label="Importar cifra" title="Importar cifra">
        <PlusIcon />
      </button>
    </div>
  )
}
