import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { DEMO_RAW } from './data/demo'
import { LibraryHome } from './components/LibraryHome'
import { ListsView } from './components/ListsView'
import { RecordingsTab } from './components/RecordingsTab'
import { SettingsTab } from './components/SettingsTab'
import { TunerTab } from './components/TunerTab'
import { TabBar, type LibraryTab } from './components/TabBar'
import { ImportView } from './components/ImportView'
import { SongView } from './components/SongView'
import { useToast } from './components/Toast'
import { initShareTarget } from './native/shareTarget'
import { saveAppFile } from './native/fileStorage'
import { DEFAULT_PRACTICE, DEFAULT_SETTINGS, loadDBAsync, mergeDB, newId, saveDBAsync, type DB, type SongSettings } from './store/db'
import { buildBackup, countRecordings, parseBackup, quickBackupText, restoreBackupRecordings, type Backup } from './store/backup'
import { deleteCustomTuning, loadCustomTunings, saveCustomTuning } from './store/customTunings'
import { getDisplayDefaults } from './store/defaults'
import { deleteAllRecordings } from './store/recordings'
import { maybeRunAutoBackup } from './store/autoBackup'
import { computeSongMeta } from './cifra/meta'
import type { Tuning } from './theory/tunings'

type Route = { view: 'library' } | { view: 'import' } | { view: 'song'; id: string; listId?: string }

/** Padrões escolhidos pelo usuário em Configurações, por cima do reset de fábrica. */
function newSongSettings(): SongSettings {
  const { tuning } = getDisplayDefaults()
  return { ...DEFAULT_SETTINGS, tuning }
}

const DEMO_SEEDED_KEY = 'cifrasgroup:demoSeeded'

/** Só semeia a música de exemplo uma vez na vida do app — sem isso, quem apaga
 *  o exemplo de propósito via voltar a vê-lo na próxima vez que a biblioteca ficar vazia. */
function withDemoSong(loaded: DB): DB {
  if (Object.keys(loaded.songs).length > 0) return loaded
  if (localStorage.getItem(DEMO_SEEDED_KEY)) return loaded
  localStorage.setItem(DEMO_SEEDED_KEY, '1')
  const id = newId()
  loaded.songs[id] = {
    id,
    title: 'Grade de estudo (exemplo)',
    artist: '',
    source: null,
    raw: DEMO_RAW,
    notes: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: newSongSettings(),
    meta: computeSongMeta(DEMO_RAW),
    practice: { ...DEFAULT_PRACTICE },
  }
  return loaded
}

/**
 * Backup completo (músicas, listas e gravações de prática) como arquivo JSON,
 * gravado na pasta do app em Documentos — o mesmo caminho das cifras, das
 * gravações e do backup automático semanal.
 *
 * Antes era um download de blob (`<a download>`), que no WebView do app nativo
 * não deixa o arquivo em lugar nenhum que o usuário consiga achar depois. No
 * navegador, saveAppFile continua caindo no download comum.
 */
async function saveFullBackup(db: DB, filename: string) {
  return saveAppFile('backups', filename, await buildBackup(db))
}

export default function App() {
  const [db, setDb] = useState<DB | null>(null)
  const [route, setRoute] = useState<Route>({ view: 'library' })
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('inicio')
  const [picker, setPicker] = useState<string | null>(null)
  const [sharedUrl, setSharedUrl] = useState<string | null>(null)
  const [customTunings, setCustomTunings] = useState<Tuning[]>([])
  const [importChoice, setImportChoice] = useState<Backup | null>(null)
  const showToast = useToast()

  useEffect(() => {
    let cancelled = false
    void loadDBAsync().then((loaded) => {
      if (cancelled) return
      const withDemo = withDemoSong(loaded)
      setDb(withDemo)
      void maybeRunAutoBackup(withDemo)
    })
    void loadCustomTunings().then((loaded) => {
      if (!cancelled) setCustomTunings(loaded)
    })
    return () => { cancelled = true }
  }, [])

  const handleSaveCustomTuning = (tuning: Tuning) => {
    void saveCustomTuning(customTunings, tuning).then(setCustomTunings)
  }
  const handleDeleteCustomTuning = (id: string) => {
    void deleteCustomTuning(customTunings, id).then(setCustomTunings)
  }

  // salva no IndexedDB com debounce: arrastar um slider (bpm, limiar, rolagem)
  // dispara uma mudança de estado por frame, e sem isso cada uma serializava
  // e regravava a biblioteca inteira (letras incluídas) no aparelho
  const loadedOnce = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const pendingSave = useRef<DB | null>(null)
  const flushSave = useRef(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = null
    const toSave = pendingSave.current
    pendingSave.current = null
    if (toSave) {
      void saveDBAsync(toSave).then((ok) => {
        if (!ok) showToast('Não foi possível salvar as mudanças neste aparelho.', { duration: 8000 })
      })
    }
  })
  useEffect(() => {
    if (!db) return
    // não salva de volta a própria carga inicial, só mudanças feitas depois
    if (!loadedOnce.current) { loadedOnce.current = true; return }
    pendingSave.current = db
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(flushSave.current, 500)
  }, [db])

  // grava imediatamente se o app for pra segundo plano ou fechar com uma
  // gravação ainda pendente — sem isso a última mudança podia se perder
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushSave.current() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onVisibility)
      flushSave.current()
    }
  }, [])

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

  const patchSong = (id: string, patch: Partial<Pick<DB['songs'][string], 'title' | 'artist' | 'notes' | 'tags'>>) => {
    setDb({
      ...db,
      songs: { ...db.songs, [id]: { ...db.songs[id], ...patch, updatedAt: Date.now() } },
    })
  }

  // editar o texto da cifra muda tudo o que é derivado dela: dificuldade,
  // contagem de acordes e prévia da biblioteca vêm de `meta`, calculado uma vez.
  // guarda o texto anterior pra dar 1 nível de desfazer (colar errado, apagar
  // trecho sem querer) sem precisar de histórico completo
  const changeRaw = (id: string, raw: string) => {
    setDb({
      ...db,
      songs: {
        ...db.songs,
        [id]: { ...db.songs[id], previousRaw: db.songs[id].raw, raw, meta: computeSongMeta(raw), updatedAt: Date.now() },
      },
    })
  }

  const undoRawChange = (id: string) => {
    setDb((prev) => {
      if (!prev) return prev
      const song = prev.songs[id]
      if (song?.previousRaw === undefined) return prev
      const raw = song.previousRaw
      return {
        ...prev,
        songs: { ...prev.songs, [id]: { ...song, raw, previousRaw: undefined, meta: computeSongMeta(raw), updatedAt: Date.now() } },
      }
    })
  }

  // registrada quando o metrônomo é desligado — cada vez que tocou "com o metrônomo"
  // conta como uma sessão de prática desta música
  const logPractice = (id: string, ms: number) => {
    setDb((prev) => {
      if (!prev) return prev
      const song = prev.songs[id]
      if (!song) return prev
      const practice = {
        count: song.practice.count + 1,
        totalMs: song.practice.totalMs + ms,
        lastPlayedAt: Date.now(),
      }
      return { ...prev, songs: { ...prev.songs, [id]: { ...song, practice } } }
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
            songs: {
              ...db.songs,
              [id]: {
                id,
                ...data,
                notes: '',
                tags: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                settings: newSongSettings(),
                meta: computeSongMeta(data.raw),
                practice: { ...DEFAULT_PRACTICE },
              },
            },
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
          onRawChange={(raw) => changeRaw(song.id, raw)}
          onUndoRawChange={() => undoRawChange(song.id)}
          onTagsChange={(tags) => patchSong(song.id, { tags })}
          onPracticeSession={(ms) => logPractice(song.id, ms)}
          customTunings={customTunings}
          onSaveCustomTuning={handleSaveCustomTuning}
          onDeleteCustomTuning={handleDeleteCustomTuning}
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

  // as gravações de prática ficam num IndexedDB separado (store/recordings) e só
  // são apagadas de verdade depois da janela de desfazer expirar — enquanto isso
  // continuam intactas no aparelho, mesmo se o app fechar antes do toast sumir
  const DELETE_UNDO_MS = 8000
  const onDeleteSong = (id: string) => {
    const prev = db
    const song = db.songs[id]
    if (!song) return
    const songs = { ...db.songs }
    delete songs[id]
    setDb({ ...db, songs, lists: db.lists.map((l) => ({ ...l, songIds: l.songIds.filter((x) => x !== id) })) })
    let undone = false
    const timer = window.setTimeout(() => {
      if (!undone) void deleteAllRecordings(id)
    }, DELETE_UNDO_MS)
    showToast(`"${song.title}" apagada.`, {
      duration: DELETE_UNDO_MS,
      actionLabel: 'Desfazer',
      onAction: () => {
        undone = true
        window.clearTimeout(timer)
        setDb(prev)
      },
    })
  }

  const onDuplicateSong = (id: string) => {
    const song = db.songs[id]
    if (!song) return
    const copyId = newId()
    const now = Date.now()
    setDb({
      ...db,
      songs: { ...db.songs, [copyId]: { ...song, id: copyId, title: `${song.title} (cópia)`, createdAt: now, updatedAt: now } },
    })
    showToast(`"${song.title} (cópia)" criada.`)
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {libraryTab === 'inicio' && (
          <LibraryHome
            db={db}
            onOpen={(id, listId) => setRoute({ view: 'song', id, listId })}
            onNew={() => setRoute({ view: 'import' })}
            onDeleteSong={onDeleteSong}
            onDuplicateSong={onDuplicateSong}
          />
        )}
        {libraryTab === 'listas' && (
          <ListsView
            db={db}
            onOpen={(id, listId) => setRoute({ view: 'song', id, listId })}
            onDuplicateSong={onDuplicateSong}
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
          />
        )}
        {libraryTab === 'afinacao' && (
          <TunerTab
            customTunings={customTunings}
            onSaveCustomTuning={handleSaveCustomTuning}
            onDeleteCustomTuning={handleDeleteCustomTuning}
          />
        )}
        {libraryTab === 'gravacoes' && <RecordingsTab songs={db.songs} />}
        {libraryTab === 'config' && (
          <SettingsTab
            songs={db.songs}
            customTunings={customTunings}
            onExport={() =>
              saveFullBackup(db, `cifrasgroup-backup-${new Date().toISOString().slice(0, 10)}.json`).then((res) => {
                if (res.savedToDevice) showToast(`Backup salvo em ${res.path}.`, { duration: 8000 })
              })
            }
            onImport={(json) => {
              const next = parseBackup(json)
              if (!next) { showToast('Arquivo de backup inválido.'); return }
              setImportChoice(next)
            }}
          />
        )}
      </div>
      <TabBar active={libraryTab} onChange={setLibraryTab} />

      {importChoice && (
        <ImportChoiceSheet
          songCount={Object.keys(importChoice.db.songs).length}
          recordingCount={countRecordings(importChoice)}
          onClose={() => setImportChoice(null)}
          onChoose={(mode) => {
            const incoming = importChoice
            if (!incoming) return
            void saveAppFile('backups', `cifrasgroup-backup-antes-de-importar-${Date.now()}.json`, quickBackupText(db))
            // na mesclagem as músicas entram com ids novos; no "substituir tudo"
            // os ids do arquivo são os que valem, então o mapa é a identidade
            const { db: next, idMap } =
              mode === 'merge'
                ? mergeDB(db, incoming.db)
                : { db: incoming.db, idMap: new Map(Object.keys(incoming.db.songs).map((id) => [id, id])) }
            setDb(next)
            setImportChoice(null)
            void restoreBackupRecordings(incoming, idMap)
            showToast(mode === 'merge' ? 'Backup mesclado com a biblioteca atual.' : 'Backup importado, substituindo a biblioteca.')
          }}
        />
      )}
    </div>
  )
}

function ImportChoiceSheet({ songCount, recordingCount, onChoose, onClose }: {
  songCount: number
  recordingCount: number
  onChoose: (mode: 'merge' | 'replace') => void
  onClose: () => void
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>Importar backup</h3>
          <button className="icon" onClick={onClose}><X /></button>
        </div>
        <p className="hint small">
          O arquivo tem {songCount} música{songCount === 1 ? '' : 's'}
          {recordingCount > 0 && <> e {recordingCount} gravaç{recordingCount === 1 ? 'ão' : 'ões'} de prática</>}.
          Um backup do estado atual é baixado automaticamente antes de aplicar, para poder desfazer se precisar.
        </p>
        <div className="listpick">
          <button className="btn wide stacked" onClick={() => onChoose('merge')}>
            <strong>mesclar com a biblioteca atual</strong>
            <span className="hint small">músicas repetidas (mesmo título e artista) são mantidas como estão</span>
          </button>
          <button className="btn wide stacked danger" onClick={() => onChoose('replace')}>
            <strong>substituir tudo</strong>
            <span className="hint small">apaga a biblioteca atual e coloca só o que está no backup</span>
          </button>
        </div>
      </div>
    </div>
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
          <button className="icon" onClick={onClose}><X /></button>
        </div>
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
