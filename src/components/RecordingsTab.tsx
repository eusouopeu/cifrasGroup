/**
 * Aba "Gravações": todas as gravações de prática do app, de todas as
 * músicas, agrupadas por música (accordion) e, dentro de cada uma,
 * alternando entre áudio e vídeo — sem precisar abrir cada música pra achar
 * uma tomada antiga.
 */
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { deleteRecording, listAllRecordings, renameRecording, togglePinned, type Recording } from '../store/recordings'
import type { Song } from '../store/db'
import { FontSizeToggleButton, InstrumentToggleButton } from './DisplayControls'
import { RecordingRow } from './song/RecordingRow'
import { ThemeToggleButton } from './ThemeControls'

type Kind = 'audio' | 'video'

export function RecordingsTab({ songs }: { songs: Record<string, Song> }) {
  const [bySong, setBySong] = useState<Record<string, Recording[]> | null>(null)
  const [openSongs, setOpenSongs] = useState<Set<string>>(new Set())
  const [kindTab, setKindTab] = useState<Record<string, Kind>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listAllRecordings(Object.keys(songs)).then((r) => { if (!cancelled) setBySong(r) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mutate = (songId: string, list: Recording[]) => {
    setBySong((cur) => {
      const next = { ...(cur ?? {}) }
      if (list.length === 0) delete next[songId]
      else next[songId] = list
      return next
    })
  }

  const toggleSong = (id: string) => {
    setOpenSongs((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const entries = bySong
    ? Object.entries(bySong)
        .map(([id, list]) => ({ id, song: songs[id], list }))
        .filter((e): e is { id: string; song: Song; list: Recording[] } => !!e.song)
        .sort((a, b) => (b.list[0]?.createdAt ?? 0) - (a.list[0]?.createdAt ?? 0))
    : []

  return (
    <div className="library">
      <header className="apphead">
        <h1>Gravações</h1>
        <FontSizeToggleButton />
        <InstrumentToggleButton />
        <ThemeToggleButton />
      </header>

      {bySong === null && <p className="hint">Carregando…</p>}
      {bySong !== null && entries.length === 0 && <p className="empty">Nenhuma gravação de prática ainda.</p>}

      <div className="flex flex-col gap-2 mt-2.5">
        {entries.map(({ id, song, list }) => {
          const open = openSongs.has(id)
          const kind = kindTab[id] ?? 'audio'
          const audio = list.filter((r) => r.kind === 'audio')
          const video = list.filter((r) => r.kind === 'video')
          const shown = kind === 'audio' ? audio : video

          return (
            <div key={id} className="bg-bg2 border border-line rounded-[10px] overflow-hidden">
              <button className="w-full flex items-center gap-2 p-[.7rem_.8rem] bg-none border-0 text-inherit text-left" onClick={() => toggleSong(id)} aria-expanded={open}>
                {open ? <ChevronDown className="w-4 h-4 text-dim flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-dim flex-shrink-0" />}
                <span className="flex-1 min-w-0 flex flex-col gap-0.5 [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap">
                  <strong>{song.title}</strong>
                  <span className="hint small">{song.artist || '—'}</span>
                </span>
                <span className="count">{list.length}</span>
              </button>

              {open && (
                <div className="p-[0_.8rem_.8rem] flex flex-col gap-2">
                  <div className="toggle">
                    <button className={kind === 'audio' ? 'on' : ''} onClick={() => setKindTab((c) => ({ ...c, [id]: 'audio' }))}>
                      Áudio ({audio.length})
                    </button>
                    <button className={kind === 'video' ? 'on' : ''} onClick={() => setKindTab((c) => ({ ...c, [id]: 'video' }))}>
                      Vídeo ({video.length})
                    </button>
                  </div>

                  {shown.length === 0 && <p className="hint small">Nenhuma gravação de {kind === 'audio' ? 'áudio' : 'vídeo'} nesta música.</p>}

                  <div className="flex flex-col gap-1.5">
                    {shown.map((r) => (
                      <RecordingRow
                        key={r.id}
                        recording={r}
                        songTitle={song.title}
                        expanded={expanded === r.id}
                        onToggleExpand={() => setExpanded((cur) => (cur === r.id ? null : r.id))}
                        onRename={(title) => void renameRecording(id, r.id, title).then((next) => mutate(id, next))}
                        onTogglePin={() => void togglePinned(id, r.id).then((next) => mutate(id, next))}
                        onDelete={() => {
                          if (expanded === r.id) setExpanded(null)
                          void deleteRecording(id, r.id).then((next) => mutate(id, next))
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
