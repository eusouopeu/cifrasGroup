/**
 * Gravador de prática flutuante: fica sobre a cifra (não a esconde) enquanto
 * grava áudio ou vídeo. O modo (mic/câmera) é escolhido na barra de
 * transporte, que também abre/fecha este componente — aqui só cabem os
 * controles de gravar/parar, o preview de vídeo e o popup com a lista de
 * gravações desta música.
 */
import { useEffect, useRef, useState } from 'react'
import { Folder, Square, X } from 'lucide-react'
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
import { saveAppFile } from '../native/fileStorage'
import { RecordingRow } from './song/RecordingRow'
import { recordingFilename } from './song/recordingFile'

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
/** vertical 9:16 — pronto para postar em reels/TikTok/shorts sem cortar depois */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  aspectRatio: { ideal: 9 / 16 },
  width: { ideal: 1080 },
  height: { ideal: 1920 },
}

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
/** câmera "sempre ligada" enquanto o modo vídeo está selecionado — mesmo antes de apertar gravar */
type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied'

export function Recorder({ songId, songTitle, mode }: { songId: string; songTitle: string; mode: RecordingKind }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
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
  // stream da câmera aberta assim que o modo vídeo é escolhido — a gravação
  // reaproveita esse mesmo stream em vez de pedir a câmera de novo
  const videoStreamRef = useRef<MediaStream | null>(null)
  // o modo pode mudar (mic/câmera) enquanto este componente segue montado;
  // uma gravação em andamento deve continuar no modo em que começou
  const activeModeRef = useRef<RecordingKind>(mode)

  useEffect(() => {
    let cancelled = false
    void listRecordings(songId).then((list) => { if (!cancelled) setRecordings(list) })
    return () => { cancelled = true }
  }, [songId])

  // modo vídeo = câmera ligada e visível na hora, sem esperar o botão de
  // gravar — é a ação de tocar no ícone de vídeo que autoriza o acesso, não
  // um som qualquer captado passivamente. Só reage à troca de modo (não ao
  // status de gravação): se dependesse do status também, o instante em que
  // "gravar" muda o status já dispararia a limpeza deste efeito e derrubaria
  // o stream que a própria gravação está usando.
  useEffect(() => {
    if (mode !== 'video') return
    if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus('denied'); return }
    let cancelled = false
    setCameraStatus('starting')
    void navigator.mediaDevices
      .getUserMedia({ video: VIDEO_CONSTRAINTS, audio: AUDIO_CONSTRAINTS })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        videoStreamRef.current = stream
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream
          void videoPreviewRef.current.play().catch(() => {})
        }
        setCameraStatus('ready')
      })
      .catch(() => { if (!cancelled) setCameraStatus('denied') })
    return () => {
      cancelled = true
      // uma gravação em andamento continua com o stream até parar sozinha —
      // trocar de modo no meio de uma gravação não deve cortar o áudio/vídeo
      if (mediaRecorderRef.current?.state === 'recording') return
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
      setCameraStatus('idle')
    }
  }, [mode])

  // encerra microfone/câmera e gravação em andamento se a música mudar ou o gravador fechar
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
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
        // reaproveita o stream da câmera já ligada pelo modo vídeo — pedir de
        // novo aqui piscaria o preview e poderia disparar outro prompt de permissão
        const stream = videoStreamRef.current
        if (!stream) { setStatus('denied'); return }
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
      // no modo vídeo o stream é o preview compartilhado (câmera continua
      // ligada depois de parar); no modo áudio é um stream só da gravação
      if (kind === 'audio') {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      mixRef.current?.stop()
      mixRef.current = null
      void saveRecording(songId, blob, durationMs, kind, layered).then(setRecordings)
      // além de guardar no app (pra tocar/empilhar), salva uma cópia em
      // Documentos/CifrasGroup no aparelho — é o arquivo "de verdade" que sai do app
      void saveAppFile(kind === 'video' ? 'videos' : 'audios', recordingFilename(songTitle, '', Date.now(), blob.type, kind), blob)
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
    <div className="fixed right-[1.1rem] bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-[15] flex flex-col items-end gap-2">
      {mode === 'video' && (
        <video
          ref={videoPreviewRef}
          className="w-[150px] aspect-[9/16] rounded-xl bg-black object-cover shadow-[0_4px_14px_rgba(0,0,0,.3)]"
          muted
          playsInline
        />
      )}

      {listOpen && (
        <div className="w-[min(370px,calc(100vw-1.6rem))] max-h-[60vh] overflow-y-auto bg-bg2 border border-line rounded-2xl p-[.7rem_.8rem] shadow-[0_8px_20px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between mb-1.5">
            <strong>Gravações desta música</strong>
            <button className="icon small" aria-label="Fechar lista" onClick={() => setListOpen(false)}><X /></button>
          </div>
          {recordings === null && <p className="hint small">Carregando…</p>}
          {recordings !== null && recordings.length === 0 && <p className="hint small">Nenhuma gravação ainda.</p>}
          <div className="flex flex-col gap-1.5">
            {recordings?.map((r) => (
              <RecordingRow
                key={r.id}
                recording={r}
                songTitle={songTitle}
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

      <div className="flex items-center gap-2">
        <div className="flex bg-bg2 border border-line rounded-full overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,.3)]">
          <button
            className="w-[46px] h-[46px] flex items-center justify-center bg-none border-0 text-fg disabled:opacity-35"
            disabled={status === 'recording' || status === 'starting' || (mode === 'video' && cameraStatus !== 'ready')}
            onClick={() => void startRecording()}
            aria-label={status === 'starting' ? 'Preparando…' : `Gravar ${mode === 'video' ? 'vídeo' : 'áudio'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block flex-shrink-0" />
          </button>
          <button
            className="w-[46px] h-[46px] flex items-center justify-center bg-none border-0 border-l border-line text-danger disabled:opacity-35 [&>svg]:w-[18px] [&>svg]:h-[18px]"
            disabled={status !== 'recording'}
            onClick={stopRecording}
            aria-label="Parar gravação"
          >
            <Square />
          </button>
        </div>
        <button
          className={`w-[46px] h-[46px] rounded-full border-0 text-[#14161a] flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,.3)] [&>svg]:w-5 [&>svg]:h-5 ${
            listOpen ? 'bg-[color-mix(in_srgb,var(--accent)_70%,#000)]' : 'bg-accent'
          }`}
          onClick={() => setListOpen((v) => !v)}
          aria-label={listOpen ? 'Fechar gravações' : 'Ver gravações'}
        >
          <Folder />
        </button>
      </div>

      {status === 'recording' && (
        <span className="bg-bg2 border border-line rounded-full py-[.2rem] px-[.7rem] text-[.78rem] text-danger mono">{formatDuration(elapsedMs)}</span>
      )}
      {status === 'idle' && mode === 'video' && cameraStatus === 'starting' && (
        <p className="hint max-w-[260px] text-right bg-bg2 border border-line rounded-lg p-[.4rem_.6rem]">Ligando a câmera…</p>
      )}
      {status === 'idle' && mode === 'video' && cameraStatus === 'denied' && (
        <p className="hint danger max-w-[260px] text-right bg-bg2 border border-line rounded-lg p-[.4rem_.6rem]">Não consegui acessar a câmera/microfone. Confira a permissão nas configurações do navegador ou do app.</p>
      )}
      {status === 'denied' && (
        <p className="hint danger max-w-[260px] text-right bg-bg2 border border-line rounded-lg p-[.4rem_.6rem]">
          Não consegui acessar {mode === 'video' ? 'o microfone e/ou a câmera' : 'o microfone'}. Confira a permissão nas
          configurações do navegador ou do app.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="hint danger max-w-[260px] text-right bg-bg2 border border-line rounded-lg p-[.4rem_.6rem]">Este navegador não sabe gravar {mode === 'video' ? 'vídeo' : 'áudio'}.</p>
      )}
    </div>
  )
}
