import { useEffect, useState } from 'react'
import { DEMO_RAW } from './data/demo'
import { Library } from './components/Library'
import { ImportView } from './components/ImportView'
import { SongView } from './components/SongView'
import { useToast } from './components/Toast'
import { initShareTarget } from './native/shareTarget'
import { DEFAULT_SETTINGS, exportDB, importDB, loadDB, newId, saveDB, type DB, type SongSettings } from './store/db'

type Route = { view: 'library' } | { view: 'import' } | { view: 'song'; id: string }

export default function App() {
  const [db, setDb] = useState<DB>(() => {
    const loaded = loadDB()
    if (Object.keys(loaded.songs).length === 0) {
      const id = newId()
      loaded.songs[id] = {
        id,
        title: 'Grade de estudo (exemplo)',
        artist: 'cifrasGroup',
        source: null,
        raw: DEMO_RAW,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings: { ...DEFAULT_SETTINGS },
      }
    }
    return loaded
  })
  const [route, setRoute] = useState<Route>({ view: 'library' })
  const [picker, setPicker] = useState<string | null>(null)
  const [sharedUrl, setSharedUrl] = useState<string | null>(null)
  const showToast = useToast()

  useEffect(() => {
    if (!saveDB(db)) {
      showToast('Não foi possível salvar: armazenamento cheio. Exporte um backup e apague músicas antigas.', { duration: 8000 })
    }
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

  const patchSettings = (id: string, patch: Partial<SongSettings>) => {
    setDb((cur) => ({
      ...cur,
      songs: {
        ...cur.songs,
        [id]: { ...cur.songs[id], updatedAt: Date.now(), settings: { ...cur.songs[id].settings, ...patch } },
      },
    }))
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
          const id = newId()
          setDb((cur) => ({
            ...cur,
            songs: { ...cur.songs, [id]: { id, ...data, createdAt: Date.now(), updatedAt: Date.now(), settings: { ...DEFAULT_SETTINGS } } },
          }))
          setSharedUrl(null)
          setRoute({ view: 'song', id })
        }}
      />
    )
  }

  if (route.view === 'song') {
    const song = db.songs[route.id]
    if (!song) return <div className="empty">Música não encontrada. <button className="btn" onClick={() => setRoute({ view: 'library' })}>voltar</button></div>
    return (
      <>
        <SongView
          song={song}
          onBack={() => setRoute({ view: 'library' })}
          onChange={(patch) => patchSettings(song.id, patch)}
          onSaveToList={() => setPicker(song.id)}
        />
        {picker && (
          <ListPicker
            db={db}
            onClose={() => setPicker(null)}
            onPick={(listId) => {
              setDb((cur) => ({
                ...cur,
                lists: cur.lists.map((l) =>
                  l.id === listId && !l.songIds.includes(picker) ? { ...l, songIds: [...l.songIds, picker] } : l,
                ),
              }))
              setPicker(null)
            }}
            onCreate={(name) => {
              const id = newId()
              setDb((cur) => ({ ...cur, lists: [...cur.lists, { id, name, description: '', songIds: [picker], createdAt: Date.now() }] }))
              setPicker(null)
            }}
          />
        )}
      </>
    )
  }

  return (
    <Library
      db={db}
      onOpen={(id) => setRoute({ view: 'song', id })}
      onNew={() => setRoute({ view: 'import' })}
      onDeleteSong={(id) => {
        const prev = db
        const song = db.songs[id]
        if (!song) return
        setDb((cur) => {
          const songs = { ...cur.songs }
          delete songs[id]
          return { ...cur, songs, lists: cur.lists.map((l) => ({ ...l, songIds: l.songIds.filter((x) => x !== id) })) }
        })
        showToast(`"${song.title}" apagada.`, { actionLabel: 'Desfazer', onAction: () => setDb(prev) })
      }}
      onDuplicateSong={(id) => {
        const song = db.songs[id]
        if (!song) return
        const copyId = newId()
        const now = Date.now()
        setDb((cur) => ({
          ...cur,
          songs: { ...cur.songs, [copyId]: { ...song, id: copyId, title: `${song.title} (cópia)`, createdAt: now, updatedAt: now } },
        }))
        showToast(`"${song.title} (cópia)" criada.`)
      }}
      onCreateList={(name) => setDb((cur) => ({ ...cur, lists: [...cur.lists, { id: newId(), name, description: '', songIds: [], createdAt: Date.now() }] }))}
      onDeleteList={(id) => {
        const prev = db
        const list = db.lists.find((l) => l.id === id)
        if (!list) return
        setDb((cur) => ({ ...cur, lists: cur.lists.filter((l) => l.id !== id) }))
        showToast(`Lista "${list.name}" apagada. As músicas continuam salvas.`, { actionLabel: 'Desfazer', onAction: () => setDb(prev) })
      }}
      onRemoveFromList={(listId, songId) =>
        setDb((cur) => ({ ...cur, lists: cur.lists.map((l) => (l.id === listId ? { ...l, songIds: l.songIds.filter((x) => x !== songId) } : l)) }))
      }
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
