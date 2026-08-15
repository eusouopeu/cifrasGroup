import { useMemo, useState } from 'react'
import type { DB, Song, SongList } from '../store/db'
import { guessKey, uniqueChords, parseCifra } from '../cifra/parse'
import { nameOf } from '../theory/notes'
import { PALETTES } from '../theory/palettes'
import { chordDifficulty } from '../theory/voicings'
import { getTheme, setTheme, type ThemePref } from '../store/theme'
import { useToast } from './Toast'

type Difficulty = 'fácil' | 'médio' | 'difícil'

function difficultyOf(symbols: string[]): Difficulty {
  if (symbols.length === 0) return 'fácil'
  const avg = symbols.reduce((sum, s) => sum + chordDifficulty(s), 0) / symbols.length
  if (avg < 60) return 'fácil'
  if (avg < 150) return 'médio'
  return 'difícil'
}

const THEME_CYCLE: ThemePref[] = ['system', 'light', 'dark']
const THEME_ICON: Record<ThemePref, string> = { system: '🖥️', light: '☀️', dark: '🌙' }
const THEME_LABEL: Record<ThemePref, string> = { system: 'tema: sistema', light: 'tema: claro', dark: 'tema: escuro' }

export function Library({ db, onOpen, onNew, onOpenTuner, onDeleteSong, onDuplicateSong, onCreateList, onDeleteList, onRemoveFromList, onReorderSong, onExport, onImport }: {
  db: DB
  onOpen: (id: string, listId?: string) => void
  onNew: () => void
  onOpenTuner: () => void
  onDeleteSong: (id: string) => void
  onDuplicateSong: (id: string) => void
  onCreateList: (name: string) => void
  onDeleteList: (id: string) => void
  onRemoveFromList: (listId: string, songId: string) => void
  onReorderSong: (listId: string, songId: string, dir: 'up' | 'down') => void
  onExport: () => void
  onImport: (json: string) => void
}) {
  const [query, setQuery] = useState('')
  const [newList, setNewList] = useState('')
  const [theme, setThemeState] = useState<ThemePref>(getTheme)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [keyFilter, setKeyFilter] = useState<number | null>(null)
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | null>(null)
  const [paletteFilter, setPaletteFilter] = useState<string | null>(null)
  const showToast = useToast()
  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
    setThemeState(next)
  }
  const songs = useMemo(() => Object.values(db.songs).sort((a, b) => b.updatedAt - a.updatedAt), [db.songs])

  // tom original e dificuldade média são derivados do texto da cifra — só
  // recalculados quando a lista de músicas muda, não a cada tecla da busca
  const songMeta = useMemo(() => {
    const map = new Map<string, { keyPc: number | null; difficulty: Difficulty }>()
    for (const s of songs) {
      const parsed = parseCifra(s.raw)
      const uniq = uniqueChords(parsed)
      map.set(s.id, { keyPc: guessKey(parsed), difficulty: difficultyOf(uniq.map((c) => c.symbol)) })
    }
    return map
  }, [songs])

  const allTags = useMemo(() => [...new Set(songs.flatMap((s) => s.tags))].sort(), [songs])
  const usedKeys = useMemo(() => [...new Set([...songMeta.values()].map((m) => m.keyPc).filter((k): k is number => k !== null))].sort((a, b) => a - b), [songMeta])
  const usedPalettes = useMemo(() => [...new Set(songs.map((s) => s.settings.paletteId))].filter((id) => id !== 'original'), [songs])
  const hasActiveFilters = tagFilter !== null || keyFilter !== null || difficultyFilter !== null || paletteFilter !== null

  const filtered = songs.filter((s) => {
    if (query && !(s.title + ' ' + s.artist).toLowerCase().includes(query.toLowerCase())) return false
    if (tagFilter !== null && !s.tags.includes(tagFilter)) return false
    const meta = songMeta.get(s.id)
    if (keyFilter !== null && meta?.keyPc !== keyFilter) return false
    if (difficultyFilter !== null && meta?.difficulty !== difficultyFilter) return false
    if (paletteFilter !== null && s.settings.paletteId !== paletteFilter) return false
    return true
  })

  return (
    <div className="library">
      <header className="apphead">
        <h1>cifras<span>Group</span></h1>
        <button className="icon" onClick={cycleTheme} aria-label={THEME_LABEL[theme]} title={THEME_LABEL[theme]}>{THEME_ICON[theme]}</button>
        <button className="btn ghost" onClick={onOpenTuner} aria-label="Afinador">🎵 afinador</button>
        <button className="btn primary" onClick={onNew}>+ Importar cifra</button>
      </header>

      <input className="search" placeholder="Buscar por título ou artista" value={query} onChange={(e) => setQuery(e.target.value)} />

      {songs.length > 0 && (
        <div className="filterbar">
          <select value={keyFilter ?? ''} onChange={(e) => setKeyFilter(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">tom: qualquer</option>
            {usedKeys.map((k) => <option key={k} value={k}>tom: {nameOf(k)}</option>)}
          </select>
          <select value={difficultyFilter ?? ''} onChange={(e) => setDifficultyFilter(e.target.value === '' ? null : (e.target.value as Difficulty))}>
            <option value="">dificuldade: qualquer</option>
            <option value="fácil">fácil</option>
            <option value="médio">médio</option>
            <option value="difícil">difícil</option>
          </select>
          {usedPalettes.length > 0 && (
            <select value={paletteFilter ?? ''} onChange={(e) => setPaletteFilter(e.target.value || null)}>
              <option value="">paleta: qualquer</option>
              {usedPalettes.map((id) => <option key={id} value={id}>{PALETTES.find((p) => p.id === id)?.name ?? id}</option>)}
            </select>
          )}
          {hasActiveFilters && (
            <button className="btn ghost small" onClick={() => { setTagFilter(null); setKeyFilter(null); setDifficultyFilter(null); setPaletteFilter(null) }}>
              limpar filtros
            </button>
          )}
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
        <input placeholder="Nova lista (ex.: Roda de violão)" value={newList} onChange={(e) => setNewList(e.target.value)} />
        <button className="btn" disabled={!newList.trim()} onClick={() => { onCreateList(newList.trim()); setNewList('') }}>criar</button>
      </div>

      <h2>Todas as músicas <span className="count">{songs.length}</span></h2>
      {filtered.length === 0 && <p className="hint">Nada aqui ainda. Importe uma cifra para começar.</p>}
      <div className="songgrid">
        {filtered.map((s) => (
          <SongCard key={s.id} song={s} onOpen={() => onOpen(s.id)} onDelete={() => onDeleteSong(s.id)} onDuplicate={() => onDuplicateSong(s.id)} />
        ))}
      </div>

      <footer className="appfoot">
        <button className="btn ghost" onClick={onExport}>exportar backup</button>
        <label className="btn ghost">
          importar backup
          <input type="file" accept="application/json" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => onImport(String(r.result))
            r.onerror = () => showToast(`Não consegui ler o arquivo "${f.name}".`)
            r.readAsText(f)
            e.target.value = ''
          }} />
        </label>
      </footer>
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
    <section className="listsection">
      <div className="listhead">
        <button className="listtoggle" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} {list.name} <span className="count">{songs.length}</span></button>
        {list.id !== 'favoritas' && <button className="icon small" onClick={() => onDeleteList(list.id)}>apagar</button>}
      </div>
      {open && (
        songs.length === 0
          ? <p className="hint small">Lista vazia. Abra uma música e use ＋ para salvá-la aqui com as configurações atuais.</p>
          : <>
              {songs.length > 1 && <p className="hint small">A ordem aqui é a ordem do repertório: use ↑↓ para reorganizar e abra qualquer música para navegar pelas outras da lista sem voltar aqui.</p>}
              <div className="songgrid">
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

function SongCard({ song, onOpen, onDelete, onDuplicate, deleteLabel = 'apagar', onMoveUp, onMoveDown }: {
  song: Song
  onOpen: () => void
  onDelete: () => void
  onDuplicate: () => void
  deleteLabel?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const chords = useMemo(() => uniqueChords(parseCifra(song.raw)).slice(0, 5).map((c) => c.symbol), [song.raw])
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

  return (
    <div className="songcard">
      <button className="songcard-main" onClick={onOpen}>
        <strong>{song.title}</strong>
        {song.artist && <span className="artist">{song.artist}</span>}
        <span className="mono chords">{chords.join(' ')}</span>
        <span className="badges">
          {visibleBadges.map((b) => <i key={b}>{b}</i>)}
          {hiddenCount > 0 && <i className="more" title={badges.slice(VISIBLE_BADGES).join(', ')}>+{hiddenCount}</i>}
        </span>
      </button>
      <div className="songcard-actions">
        {(onMoveUp || onMoveDown) && (
          <span className="reorder">
            <button className="icon small" disabled={!onMoveUp} onClick={onMoveUp} aria-label="Mover para cima">↑</button>
            <button className="icon small" disabled={!onMoveDown} onClick={onMoveDown} aria-label="Mover para baixo">↓</button>
          </span>
        )}
        <span className="songcard-iconcol">
          <button className="icon songcard-icon blue" onClick={onDuplicate} aria-label="Duplicar música" title="Duplicar">⎘</button>
          <button className="icon songcard-icon danger" onClick={onDelete} aria-label={deleteLabel === 'apagar' ? 'Apagar música' : deleteLabel} title={deleteLabel}>✕</button>
        </span>
      </div>
    </div>
  )
}
