import { useEffect, useRef, useState } from 'react'
import { DEMO_RAW } from './data/demo'
import { Library } from './components/Library'
import { ImportView } from './components/ImportView'
import { SongView } from './components/SongView'
import { useToast } from './components/Toast'
import { Tuner } from './components/Tuner'
import { initShareTarget } from './native/shareTarget'
import { DEFAULT_SETTINGS, exportDB, importDB, loadDBAsync, newId, saveDBAsync, type DB, type SongSettings } from './store/db'

type Route = { view: 'library' } | { view: 'import' } | { view: 'song'; id: string; listId?: string }

function withDemoSong(loaded: DB): DB {
  if (Object.keys(loaded.songs).length > 0) return loaded
  const id = newId()
  loaded.songs[id] = {
    id,
    title: 'Grade de estudo (exemplo)',
    artist: 'cifrasGroup',
    source: null,
    raw: DEMO_RAW,
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: { ...DEFAULT_SETTINGS },
  }
  return loaded
}

export default function App() {
  const [db, setDb] = useState<DB | null>(null)
  const [route, setRoute] = useState<Route>({ view: 'library' })
  const [picker, setPicker] = useState<string | null>(null)
  const [sharedUrl, setSharedUrl] = useState<string | null>(null)
  const [tunerOpen, setTunerOpen] = useState(false)
  const showToast = useToast()

  useEffect(() => {
    let cancelled = false
    void loadDBAsync().then((loaded) => {
      if (!cancelled) setDb(withDemoSong(loaded))
    })
    return () => { cancelled = true }
  }, [])

  const loadedOnce = useRef(false)
  useEffect(() => {
    if (!db) return
    // não salva de volta a própria carga inicial, só mudanças feitas depois
    if (!loadedOnce.current) { loadedOnce.current = true; return }
    void saveDBAsync(db).then((ok) => {
      if (!ok) showToast('Não foi possível salvar as mudanças neste aparelho.', { duration: 8000 })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  // link recebido via "Compartilhar" no Android (só existe no app nativo)
  useEffect(
    () =>
      initShareTarget((url) => {
        setSharedUrl(url)
        setRoute({ view: 'import' })
      }),
    [],
  )

  if (!db) return <div className="empty">Carregando…</div>

  const patchSettings = (id: string, patch: Partial<SongSettings>) => {
    setDb({
      ...db,
      songs: {
        ...db.songs,
        [id]: { ...db.songs[id], updatedAt: Date.now(), settings: { ...db.songs[id].settings, ...patch } },
      },
    })
  }

  const patchSong = (id: string, patch: Partial<Pick<DB['songs'][string], 'title' | 'artist' | 'notes'>>) => {
    setDb({
      ...db,
      songs: { ...db.songs, [id]: { ...db.songs[id], ...patch, updatedAt: Date.now() } },
    })
  }

  if (route.view === 'import') {
    return (
      <ImportView
        // troca de key força remontar quando chega um novo link compartilhado,
        // mesmo se a tela de importação já estiver aberta
        key={sharedUrl ?? 'manual'}
        initialUrl={sharedUrl}
        onCancel={() => {
          setSharedUrl(null)
          setRoute({ view: 'library' })
        }}
        onImport={(data) => {
          const norm = (t: string) => t.trim().toLowerCase()
          const dup = Object.values(db.songs).find(
            (s) => norm(s.title) === norm(data.title) && norm(s.artist) === norm(data.artist),
          )
          if (dup && !window.confirm(`Já existe "${dup.title}" de ${dup.artist || 'artista desconhecido'} na biblioteca. Importar mesmo assim?`)) {
            return
          }
          const id = newId()
          setDb({
            ...db,
            songs: { ...db.songs, [id]: { id, ...data, notes: '', createdAt: Date.now(), updatedAt: Date.now(), settings: { ...DEFAULT_SETTINGS } } },
          })
          setSharedUrl(null)
          setRoute({ view: 'song', id })
        }}
      />
    )
  }

  if (route.view === 'song') {
    const song = db.songs[route.id]
    if (!song) return <div className="empty">Música não encontrada. <button className="btn" onClick={() => setRoute({ view: 'library' })}>voltar</button></div>
    // modo setlist: navegar entre as músicas da lista de onde a música foi aberta
    const setlist = route.listId ? db.lists.find((l) => l.id === route.listId) : undefined
    const setlistIds = setlist?.songIds.filter((id) => db.songs[id]) ?? []
    const setlistIndex = setlistIds.indexOf(route.id)
    const siblings = setlist && setlistIds.length > 1 && setlistIndex >= 0
      ? { listName: setlist.name, ids: setlistIds, index: setlistIndex }
      : undefined
    return (
      <>
        <SongView
          song={song}
          onBack={() => setRoute({ view: 'library' })}
          onChange={(patch) => patchSettings(song.id, patch)}
          onRename={(title, artist) => patchSong(song.id, { title, artist })}
          onNotesChange={(notes) => patchSong(song.id, { notes })}
          onSaveToList={() => setPicker(song.id)}
          siblings={siblings}
          onNavigate={(id) => setRoute({ view: 'song', id, listId: route.listId })}
        />
        {picker && (
          <ListPicker
            db={db}
            onClose={() => setPicker(null)}
            onPick={(listId) => {
              setDb({
                ...db,
                lists: db.lists.map((l) =>
                  l.id === listId && !l.songIds.includes(picker) ? { ...l, songIds: [...l.songIds, picker] } : l,
                ),
              })
              setPicker(null)
            }}
            onCreate={(name) => {
              const id = newId()
              setDb({ ...db, lists: [...db.lists, { id, name, description: '', songIds: [picker], createdAt: Date.now() }] })
              setPicker(null)
            }}
          />
        )}
      </>
    )
  }

  return (
    <>
    <Library
      db={db}
      onOpen={(id, listId) => setRoute({ view: 'song', id, listId })}
      onNew={() => setRoute({ view: 'import' })}
      onOpenTuner={() => setTunerOpen(true)}
      onDeleteSong={(id) => {
        const prev = db
        const song = db.songs[id]
        if (!song) return
        const songs = { ...db.songs }
        delete songs[id]
        setDb({ ...db, songs, lists: db.lists.map((l) => ({ ...l, songIds: l.songIds.filter((x) => x !== id) })) })
        showToast(`"${song.title}" apagada.`, { actionLabel: 'Desfazer', onAction: () => setDb(prev) })
      }}
      onDuplicateSong={(id) => {
        const song = db.songs[id]
        if (!song) return
        const copyId = newId()
        const now = Date.now()
        setDb({
          ...db,
          songs: { ...db.songs, [copyId]: { ...song, id: copyId, title: `${song.title} (cópia)`, createdAt: now, updatedAt: now } },
        })
        showToast(`"${song.title} (cópia)" criada.`)
      }}
      onCreateList={(name) => setDb({ ...db, lists: [...db.lists, { id: newId(), name, description: '', songIds: [], createdAt: Date.now() }] })}
      onDeleteList={(id) => {
        const prev = db
        const list = db.lists.find((l) => l.id === id)
        if (!list) return
        setDb({ ...db, lists: db.lists.filter((l) => l.id !== id) })
        showToast(`Lista "${list.name}" apagada. As músicas continuam salvas.`, { actionLabel: 'Desfazer', onAction: () => setDb(prev) })
      }}
      onRemoveFromList={(listId, songId) =>
        setDb({ ...db, lists: db.lists.map((l) => (l.id === listId ? { ...l, songIds: l.songIds.filter((x) => x !== songId) } : l)) })
      }
      onReorderSong={(listId, songId, dir) => {
        setDb({
          ...db,
          lists: db.lists.map((l) => {
            if (l.id !== listId) return l
            const i = l.songIds.indexOf(songId)
            const j = dir === 'up' ? i - 1 : i + 1
            if (i < 0 || j < 0 || j >= l.songIds.length) return l
            const songIds = [...l.songIds]
            ;[songIds[i], songIds[j]] = [songIds[j], songIds[i]]
            return { ...l, songIds }
          }),
        })
      }}
      onExport={() => {
        const blob = new Blob([exportDB(db)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `cifrasgroup-backup.json`
        a.click()
        URL.revokeObjectURL(a.href)
      }}
      onImport={(json) => {
        const next = importDB(json)
        if (!next) { showToast('Arquivo de backup inválido.'); return }
        setDb(next)
        showToast('Backup importado.')
      }}
    />
    {tunerOpen && <Tuner onClose={() => setTunerOpen(false)} />}
    </>
  )
}

function ListPicker({ db, onPick, onCreate, onClose }: {
  db: DB
  onPick: (listId: string) => void
  onCreate: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Salvar nesta lista</h3>
          <button className="icon" onClick={onClose}>×</button>
        </div>
        <p className="hint small">As configurações atuais (tom, capo, nível de simplificação, paleta, batida, rolagem e tamanho do texto) já ficam salvas com a música.</p>
        <div className="listpick">
          {db.lists.map((l) => (
            <button key={l.id} className="btn wide" onClick={() => onPick(l.id)}>{l.name} <span className="count">{l.songIds.length}</span></button>
          ))}
        </div>
        <div className="newlist">
          <input placeholder="Nova lista" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>criar e salvar</button>
        </div>
      </div>
    </div>
  )
}
