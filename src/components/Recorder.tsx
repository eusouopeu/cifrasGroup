import { useEffect, useRef, useState } from 'react'
import { BookmarkIcon, TrashIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid'
import {
  deleteRecording,
  formatBytes,
  listRecordings,
  saveRecording,
  togglePinned,
  type Recording,
  type RecordingKind,
} from '../store/recordings'
import { startMixSession, type MixSession } from '../audio/recordMix'

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Melhor combinação de codec/contêiner suportada pelo navegador, da mais desejada pra mais compatível. */
function pickMime(candidates: string[]): string {
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

// desliga o processamento pensado pra chamada de voz (cancelamento de eco,
// supressão de ruído, ganho automático): eles comprimem e "lavam" o som,
// péssimo pra violão/canto. Bitrate bem acima do padrão do navegador (que
// costuma ficar na casa de 32-50kbps) é o resto do ganho de qualidade.
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 2 },
  sampleRate: { ideal: 48000 },
}
const AUDIO_BITRATE = 192_000
const VIDEO_BITRATE = 2_500_000

type Status = 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported'

/** Gravação de prática: áudio ou vídeo, com o microfone (e a câmera, no modo vídeo). Guarda no aparelho, toca de volta. */
export function Recorder({ songId }: { songId: string }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [mode, setMode] = useState<RecordingKind>('audio')
  const [layerIds, setLayerIds] = useState<Set<string>>(new Set())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mixRef = useRef<MixSession | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  // URLs de objeto para tocar os blobs — criadas sob demanda e revogadas ao desmontar
  const urlsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    void listRecordings(songId).then((list) => { if (!cancelled) setRecordings(list) })
    return () => { cancelled = true }
  }, [songId])

  useEffect(() => {
    const urls = urlsRef.current
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear() }
  }, [])

  // encerra microfone/câmera e gravação em andamento se o usuário sair do painel no meio
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    mixRef.current?.stop()
  }, [])

  const urlFor = (r: Recording): string => {
    let url = urlsRef.current.get(r.id)
    if (!url) {
      url = URL.createObjectURL(r.blob)
      urlsRef.current.set(r.id, url)
    }
    return url
  }

  const audioRecordings = recordings?.filter((r) => r.kind === 'audio') ?? []

  const toggleLayer = (id: string) => {
    setLayerIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unsupported')
      return
    }
    setStatus('starting')
    try {
      if (mode === 'video') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: AUDIO_CONSTRAINTS,
        })
        streamRef.current = stream
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream
          void videoPreviewRef.current.play().catch(() => {})
        }
        const mime = pickMime(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
        const mr = mime
          ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: AUDIO_BITRATE })
          : new MediaRecorder(stream)
        armRecorder(mr, 'video')
      } else {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS })
        streamRef.current = micStream
        const backing = audioRecordings.filter((r) => layerIds.has(r.id))
        let recordStream = micStream
        if (backing.length > 0) {
          const mix = await startMixSession(micStream, backing.map((r) => r.blob))
          mixRef.current = mix
          recordStream = mix.stream
        }
        const mime = pickMime(['audio/webm;codecs=opus', 'audio/webm'])
        const mr = mime
          ? new MediaRecorder(recordStream, { mimeType: mime, audioBitsPerSecond: AUDIO_BITRATE })
          : new MediaRecorder(recordStream)
        armRecorder(mr, 'audio')
      }
    } catch {
      setStatus('denied')
    }
  }

  /** Liga os eventos do MediaRecorder e o cronômetro — comum aos dois modos. */
  const armRecorder = (mr: MediaRecorder, kind: RecordingKind) => {
    chunksRef.current = []
    const layered = kind === 'audio' ? [...layerIds] : undefined
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm') })
      const durationMs = Date.now() - startTimeRef.current
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      mixRef.current?.stop()
      mixRef.current = null
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
      void saveRecording(songId, blob, durationMs, kind, layered).then(setRecordings)
    }
    mediaRecorderRef.current = mr
    startTimeRef.current = Date.now()
    mr.start()
    setElapsedMs(0)
    setStatus('recording')
    timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 200)
  }

  const stopRecording = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
    setStatus('idle')
  }

  const remove = async (id: string) => {
    const url = urlsRef.current.get(id)
    if (url) { URL.revokeObjectURL(url); urlsRef.current.delete(id) }
    setRecordings(await deleteRecording(songId, id))
  }

  const totalBytes = recordings?.reduce((sum, r) => sum + r.blob.size, 0) ?? 0

  return (
    <div className="recorder">
      {status !== 'recording' && (
        <>
          <div className="toggle recmode">
            <button
              className={mode === 'audio' ? 'on' : ''}
              onClick={() => setMode('audio')}
              aria-label="Gravar áudio"
              title="Gravar áudio"
            >
              <MicrophoneIcon />
            </button>
            <button
              className={mode === 'video' ? 'on' : ''}
              onClick={() => setMode('video')}
              aria-label="Gravar vídeo"
              title="Gravar vídeo"
            >
              <VideoCameraIcon />
            </button>
          </div>

          {mode === 'audio' && audioRecordings.length > 0 && (
            <div className="layerpicker">
              <span className="fieldlabel">Tocar junto (opcional)</span>
              <p className="hint small">Toca essas gravações em tempo real enquanto grava — a nova gravação sai com elas somadas.</p>
              <div className="layerlist">
                {audioRecordings.map((r) => (
                  <label key={r.id} className="layeritem">
                    <input type="checkbox" checked={layerIds.has(r.id)} onChange={() => toggleLayer(r.id)} />
                    {formatDate(r.createdAt)} · {formatDuration(r.durationMs)}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'video' && (status === 'recording' || status === 'starting') && (
        <video ref={videoPreviewRef} className="recorder-preview" muted playsInline />
      )}

      <div className="row">
        {status !== 'recording' ? (
          <button className="btn primary recordbtn" onClick={() => void startRecording()} disabled={status === 'starting'}>
            <span className="record-dot" /> {status === 'starting' ? 'preparando…' : `gravar ${mode === 'video' ? 'vídeo' : 'áudio'}`}
          </button>
        ) : (
          <button className="btn recording" onClick={stopRecording}><StopIcon /> parar · {formatDuration(elapsedMs)}</button>
        )}
      </div>
      {status === 'denied' && (
        <p className="hint danger">
          Não consegui acessar {mode === 'video' ? 'o microfone e/ou a câmera' : 'o microfone'}. Confira a permissão nas
          configurações do navegador ou do app.
        </p>
      )}
      {status === 'unsupported' && <p className="hint danger">Este navegador não sabe gravar {mode === 'video' ? 'vídeo' : 'áudio'}.</p>}

      <h4>Gravações desta música</h4>
      {recordings === null && <p className="hint small">Carregando…</p>}
      {recordings !== null && recordings.length === 0 && <p className="hint small">Nenhuma gravação ainda.</p>}
      {recordings !== null && recordings.length > 0 && (
        <p className="hint small">{recordings.length} gravaç{recordings.length === 1 ? 'ão' : 'ões'} · {formatBytes(totalBytes)} ocupados neste aparelho.</p>
      )}
      <div className="recordlist">
        {recordings?.map((r) => (
          <div key={r.id} className={`recorditem${r.pinned ? ' pinned' : ''}`}>
            <div className="recorditem-meta">
              <strong>{formatDate(r.createdAt)}</strong>
              <span>{r.kind === 'video' ? 'vídeo' : 'áudio'} · {formatDuration(r.durationMs)} · {formatBytes(r.blob.size)}</span>
              {r.layeredOver && r.layeredOver.length > 0 && (
                <span className="recorditem-layered">tocada sobre {r.layeredOver.length} gravação{r.layeredOver.length === 1 ? '' : 'ões'}</span>
              )}
            </div>
            {r.kind === 'video' ? (
              <video controls src={urlFor(r)} preload="none" className="recorditem-video" />
            ) : (
              <audio controls src={urlFor(r)} preload="none" />
            )}
            <button
              className={`icon small${r.pinned ? ' active' : ''}`}
              aria-label={r.pinned ? 'Remover destaque desta gravação' : 'Destacar esta gravação'}
              title={r.pinned ? 'Guardada em destaque' : 'Destacar'}
              onClick={() => void togglePinned(songId, r.id).then(setRecordings)}
            >
              {r.pinned ? <BookmarkSolidIcon /> : <BookmarkIcon />}
            </button>
            <button className="icon small danger" aria-label="Apagar gravação" onClick={() => void remove(r.id)}><TrashIcon /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
