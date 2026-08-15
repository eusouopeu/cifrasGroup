import { useMemo, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { DB } from '../store/db'
import { uniqueChords, parseCifra } from '../cifra/parse'
import { PALETTES } from '../theory/palettes'
import { chordDifficulty } from '../theory/voicings'
import { rhythmById } from '../data/rhythms'
import { SongCard } from './SongCard'

type Difficulty = 'fácil' | 'médio' | 'difícil'

function difficultyOf(symbols: string[]): Difficulty {
  if (symbols.length === 0) return 'fácil'
  const avg = symbols.reduce((sum, s) => sum + chordDifficulty(s), 0) / symbols.length
  if (avg < 60) return 'fácil'
  if (avg < 150) return 'médio'
  return 'difícil'
}

export function LibraryHome({ db, onOpen, onNew, onDeleteSong, onDuplicateSong }: {
  db: DB
  onOpen: (id: string, listId?: string) => void
  onNew: () => void
  onDeleteSong: (id: string) => void
  onDuplicateSong: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [maxChordsFilter, setMaxChordsFilter] = useState<number | ''>('')
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | null>(null)
  const [paletteFilter, setPaletteFilter] = useState<string | null>(null)
  const [genreFilter, setGenreFilter] = useState<Set<string>>(new Set())

  const songs = useMemo(() => Object.values(db.songs).sort((a, b) => b.updatedAt - a.updatedAt), [db.songs])

  // dificuldade, nº de acordes e gêneros (via ritmo escolhido) são derivados —
  // só recalculados quando a lista de músicas muda, não a cada tecla da busca
  const songMeta = useMemo(() => {
    const map = new Map<string, { difficulty: Difficulty; chordCount: number; genres: string[] }>()
    for (const s of songs) {
      const parsed = parseCifra(s.raw)
      const uniq = uniqueChords(parsed)
      const genres = rhythmById(s.settings.rhythmId)?.genres ?? []
      map.set(s.id, { difficulty: difficultyOf(uniq.map((c) => c.symbol)), chordCount: uniq.length, genres })
    }
    return map
  }, [songs])

  const allTags = useMemo(() => [...new Set(songs.flatMap((s) => s.tags))].sort(), [songs])
  const usedPalettes = useMemo(() => [...new Set(songs.map((s) => s.settings.paletteId))].filter((id) => id !== 'original'), [songs])
  const usedGenres = useMemo(() => [...new Set([...songMeta.values()].flatMap((m) => m.genres))].sort(), [songMeta])

  const hasActiveFilters = tagFilter !== null || maxChordsFilter !== '' || difficultyFilter !== null || paletteFilter !== null || genreFilter.size > 0

  const filtered = songs.filter((s) => {
    if (query && !(s.title + ' ' + s.artist).toLowerCase().includes(query.toLowerCase())) return false
    if (tagFilter !== null && !s.tags.includes(tagFilter)) return false
    const meta = songMeta.get(s.id)
    if (maxChordsFilter !== '' && (meta?.chordCount ?? 0) > maxChordsFilter) return false
    if (difficultyFilter !== null && meta?.difficulty !== difficultyFilter) return false
    if (paletteFilter !== null && s.settings.paletteId !== paletteFilter) return false
    if (genreFilter.size > 0 && !(meta?.genres ?? []).some((g) => genreFilter.has(g))) return false
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

  return (
    <div className="library">
      <header className="apphead">
        <h1>cifras<span>Group</span></h1>
        <button className="icon primary" onClick={onNew} aria-label="Importar cifra" title="Importar cifra"><PlusIcon /></button>
      </header>

      <input className="search" placeholder="Buscar por título ou artista" value={query} onChange={(e) => setQuery(e.target.value)} />

      {songs.length > 0 && (
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
          {usedPalettes.length > 0 && (
            <label className="filterfield">
              Paleta:
              <select value={paletteFilter ?? ''} onChange={(e) => setPaletteFilter(e.target.value || null)}>
                <option value="">qualquer</option>
                {usedPalettes.map((id) => <option key={id} value={id}>{PALETTES.find((p) => p.id === id)?.name ?? id}</option>)}
              </select>
            </label>
          )}
          {hasActiveFilters && (
            <button className="btn ghost small" onClick={() => { setTagFilter(null); setMaxChordsFilter(''); setDifficultyFilter(null); setPaletteFilter(null); setGenreFilter(new Set()) }}>
              limpar filtros
            </button>
          )}
        </div>
      )}

      {usedGenres.length > 0 && (
        <div className="genrefilter">
          {usedGenres.map((g) => (
            <button key={g} className={`genrechip${genreFilter.has(g) ? ' on' : ''}`} onClick={() => toggleGenre(g)}>
              {g}
            </button>
          ))}
        </div>
      )}

      {allTags.length > 0 && (
        <div className="tagchips filterbar-tags">
          {allTags.map((t) => (
            <button key={t} className={`tagchip filterchip${tagFilter === t ? ' on' : ''}`} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && <p className="hint">Nada aqui ainda. Importe uma cifra para começar.</p>}
      <div className="songgrid">
        {filtered.map((s) => (
          <SongCard key={s.id} song={s} onOpen={() => onOpen(s.id)} onDelete={() => onDeleteSong(s.id)} onDuplicate={() => onDuplicateSong(s.id)} />
        ))}
      </div>
    </div>
  )
}
