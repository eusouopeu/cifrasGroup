/**
 * Gravador de prática flutuante: fica sobre a cifra (não a esconde) enquanto
 * grava áudio ou vídeo. O modo (mic/câmera) é escolhido na barra de
 * transporte, que também abre/fecha este componente — aqui só cabem os
 * controles de gravar/parar, o preview de vídeo e o popup com a lista de
 * gravações desta música.
 */
import { useEffect, useRef, useState } from 'react'
import { FolderIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { StopIcon } from '@heroicons/react/24/solid'
import {
  deleteRecording,
  listRecordings,
  renameRecording,
  saveRecording,
  togglePinned,
  type Recording,
  type RecordingKind,
} from '../store/recordings'
import { startMixSession, type MixSession } from '../audio/recordMix'
import { RecordingRow } from './song/RecordingRow'

/** desliga o processamento de chamada de voz (eco/ruído/ganho automático) —
 *  comprime e "lava" o som, péssimo pra violão/canto. Bitrate acima do
 *  padrão do navegador é o resto do ganho de qualidade. */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 2 },
  sampleRate: { ideal: 48000 },
}
const AUDIO_BITRATE = 192_000
const VIDEO_BITRATE = 2_500_000

function pickMime(candidates: string[]): string {
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

type Status = 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported'

export function Recorder({ songId, mode }: { songId: string; mode: RecordingKind }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [listOpen, setListOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [layerIds, setLayerIds] = useState<Set<string>>(new Set())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mixRef = useRef<MixSession | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  // o modo pode mudar (mic/câmera) enquanto este componente segue montado;
  // uma gravação em andamento deve continuar no modo em que começou
  const activeModeRef = useRef<RecordingKind>(mode)

  useEffect(() => {
    let cancelled = false
    void listRecordings(songId).then((list) => { if (!cancelled) setRecordings(list) })
    return () => { cancelled = true }
  }, [songId])

  // encerra microfone/câmera e gravação em andamento se a música mudar ou o gravador fechar
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    mixRef.current?.stop()
  }, [])

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
    activeModeRef.current = mode
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
    if (expandedId === id) setExpandedId(null)
    setLayerIds((cur) => { if (!cur.has(id)) return cur; const next = new Set(cur); next.delete(id); return next })
    setRecordings(await deleteRecording(songId, id))
  }

  return (
    <div className="record-float-wrap">
      {activeModeRef.current === 'video' && (status === 'recording' || status === 'starting') && (
        <video ref={videoPreviewRef} className="record-preview-float" muted playsInline />
      )}

      {listOpen && (
        <div className="record-list-float">
          <div className="record-list-head">
            <strong>Gravações desta música</strong>
            <button className="icon small" aria-label="Fechar lista" onClick={() => setListOpen(false)}><XMarkIcon /></button>
          </div>
          {recordings === null && <p className="hint small">Carregando…</p>}
          {recordings !== null && recordings.length === 0 && <p className="hint small">Nenhuma gravação ainda.</p>}
          <div className="record-list-items">
            {recordings?.map((r) => (
              <RecordingRow
                key={r.id}
                recording={r}
                expanded={expandedId === r.id}
                onToggleExpand={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                onRename={(title) => void renameRecording(songId, r.id, title).then(setRecordings)}
                onTogglePin={() => void togglePinned(songId, r.id).then(setRecordings)}
                onDelete={() => void remove(r.id)}
                layerable={r.kind === 'audio'}
                layered={layerIds.has(r.id)}
                onToggleLayer={() => toggleLayer(r.id)}
              />
            ))}
          </div>
          {layerIds.size > 0 && (
            <p className="hint small">
              {layerIds.size} gravaç{layerIds.size === 1 ? 'ão marcada' : 'ões marcadas'} pra tocar junto na próxima gravação de áudio.
            </p>
          )}
        </div>
      )}

      <div className="record-cluster">
        <div className="record-pill">
          <button
            className="record-pill-btn record"
            disabled={status === 'recording' || status === 'starting'}
            onClick={() => void startRecording()}
            aria-label={status === 'starting' ? 'Preparando…' : `Gravar ${mode === 'video' ? 'vídeo' : 'áudio'}`}
          >
            <span className="record-dot" />
          </button>
          <button
            className="record-pill-btn stop"
            disabled={status !== 'recording'}
            onClick={stopRecording}
            aria-label="Parar gravação"
          >
            <StopIcon />
          </button>
        </div>
        <button
          className={`record-folder${listOpen ? ' on' : ''}`}
          onClick={() => setListOpen((v) => !v)}
          aria-label={listOpen ? 'Fechar gravações' : 'Ver gravações'}
        >
          <FolderIcon />
        </button>
      </div>

      {status === 'recording' && <span className="record-elapsed mono">{formatDuration(elapsedMs)}</span>}
      {status === 'denied' && (
        <p className="hint danger record-denied">
          Não consegui acessar {mode === 'video' ? 'o microfone e/ou a câmera' : 'o microfone'}. Confira a permissão nas
          configurações do navegador ou do app.
        </p>
      )}
      {status === 'unsupported' && <p className="hint danger record-denied">Este navegador não sabe gravar {mode === 'video' ? 'vídeo' : 'áudio'}.</p>}
    </div>
  )
}
