/**
 * Uma linha de gravação, usada tanto no popup flutuante do gravador
 * (song/RecordingRow dentro de Recorder.tsx) quanto na aba "Gravações" —
 * colapsada mostra só data/duração/tamanho; expandida ganha um player com
 * barra de progresso própria e a linha de ações (camadas, destaque, baixar,
 * apagar).
 */
import { useEffect, useRef, useState } from 'react'
import { Bookmark, Download, Layers, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { formatBytes, type Recording } from '../../store/recordings'

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function extensionFor(mime: string, kind: 'audio' | 'video'): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return kind === 'video' ? 'webm' : 'webm'
}

export function RecordingRow({ recording, expanded, onToggleExpand, onRename, onTogglePin, onDelete, layerable, layered, onToggleLayer, showSong }: {
  recording: Recording
  expanded: boolean
  onToggleExpand: () => void
  onRename: (title: string) => void
  onTogglePin: () => void
  onDelete: () => void
  /** só gravações de áudio podem ser tocadas junto de uma nova captura */
  layerable?: boolean
  layered?: boolean
  onToggleLayer?: () => void
  /** rótulo extra (nome da música) — usado na aba "Gravações", que junta várias músicas */
  showSong?: string
}) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(recording.title ?? '')
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)
  const urlRef = useRef<string | null>(null)
  if (!urlRef.current) urlRef.current = URL.createObjectURL(recording.blob)
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  useEffect(() => {
    if (!expanded) { setPlaying(false); mediaRef.current?.pause() }
  }, [expanded])

  const label = recording.title || formatDate(recording.createdAt)

  const togglePlay = () => {
    const el = mediaRef.current
    if (!el) return
    if (el.paused) { void el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
  }

  const commitRename = () => {
    onRename(draft)
    setRenaming(false)
  }

  const download = () => {
    const ext = extensionFor(recording.blob.type, recording.kind)
    const a = document.createElement('a')
    a.href = urlRef.current!
    a.download = `${label.replace(/[/\\]/g, '-')}.${ext}`
    a.click()
  }

  const rowBase = 'bg-bg3 border rounded-[9px] p-[.5rem_.6rem] text-left w-full'

  if (!expanded) {
    return (
      <button
        className={`${rowBase} flex items-center gap-2 ${recording.pinned ? 'border-accent2' : 'border-line'}`}
        onClick={onToggleExpand}
      >
        <span className="flex flex-col gap-[.1rem] bg-none border-0 p-0 text-left text-inherit font-inherit flex-1 min-w-0 [&>strong]:text-[.82rem] [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap">
          <strong>{label}</strong>
          <span className="hint small">
            {showSong && <>{showSong} · </>}
            {formatDuration(recording.durationMs)} - {formatBytes(recording.blob.size)}
          </span>
        </span>
        {recording.pinned && <Bookmark className="w-3.5 h-3.5 text-accent2 flex-shrink-0" fill="currentColor" />}
      </button>
    )
  }

  return (
    <div className={`${rowBase} border-line flex flex-col gap-[.4rem]`}>
      <div className="flex items-center gap-[.4rem]">
        {renaming ? (
          <input
            className="flex-1 min-w-0 bg-bg2 border border-accent rounded-md text-fg p-[.3rem_.5rem] text-[.82rem]"
            autoFocus
            value={draft}
            placeholder={formatDate(recording.createdAt)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false) }}
            onBlur={commitRename}
          />
        ) : (
          <button
            className="flex flex-col gap-[.1rem] bg-none border-0 p-0 text-left text-inherit font-inherit flex-1 min-w-0 [&>strong]:text-[.82rem] [&>strong]:overflow-hidden [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap"
            onClick={onToggleExpand}
          >
            <strong>{label}</strong>
            <span className="hint small">{showSong && <>{showSong} · </>}{formatDate(recording.createdAt)}</span>
          </button>
        )}
        <button className="icon small" aria-label="Renomear gravação" onClick={() => { setDraft(recording.title ?? ''); setRenaming(true) }}>
          <Pencil />
        </button>
      </div>

      {recording.kind === 'video' ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={urlRef.current}
          className="w-full max-h-[200px] rounded-lg bg-black"
          playsInline
          onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
          onEnded={() => setPlaying(false)}
        />
      ) : (
        <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={urlRef.current}
          onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)} onEnded={() => setPlaying(false)} />
      )}

      <div className="flex items-center gap-[.4rem]">
        <button className="icon" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Tocar'}>
          {playing ? <Pause /> : <Play />}
        </button>
        <input
          className="flex-1 min-w-0 accent-accent"
          type="range"
          min={0}
          max={recording.durationMs}
          step={100}
          value={Math.min(currentMs, recording.durationMs)}
          aria-label="Posição da gravação"
          onChange={(e) => {
            const ms = Number(e.target.value)
            if (mediaRef.current) mediaRef.current.currentTime = ms / 1000
            setCurrentMs(ms)
          }}
        />
        <span className="hint small min-w-[34px] text-right">{formatDuration(currentMs)}</span>
      </div>

      <div className="flex justify-end gap-[.15rem] [&_.icon.small.active]:text-accent2">
        {layerable && (
          <button
            className={`icon small${layered ? ' active' : ''}`}
            aria-label={layered ? 'Não tocar junto na próxima gravação' : 'Tocar junto na próxima gravação'}
            title="Tocar junto na próxima gravação"
            onClick={onToggleLayer}
          >
            <Layers />
          </button>
        )}
        <button
          className={`icon small${recording.pinned ? ' active' : ''}`}
          aria-label={recording.pinned ? 'Remover destaque' : 'Destacar'}
          title={recording.pinned ? 'Guardada em destaque' : 'Destacar'}
          onClick={onTogglePin}
        >
          <Bookmark fill={recording.pinned ? 'currentColor' : 'none'} />
        </button>
        <button className="icon small" aria-label="Baixar gravação" title="Baixar" onClick={download}>
          <Download />
        </button>
        <button className="icon small danger" aria-label="Apagar gravação" onClick={onDelete}>
          <Trash2 />
        </button>
      </div>
    </div>
  )
}
