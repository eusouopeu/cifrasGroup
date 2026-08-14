import { useEffect, useRef, useState } from 'react'
import { deleteRecording, listRecordings, saveRecording, type Recording } from '../store/recordings'

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type Status = 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported'

/** Gravação simples de prática: grava com o microfone, guarda no aparelho, toca de volta. Sem análise de afinação — só registro. */
export function Recorder({ songId }: { songId: string }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const timerRef = useRef<number | null>(null)
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

  // encerra microfone e gravação em andamento se o usuário sair do painel no meio
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const urlFor = (r: Recording): string => {
    let url = urlsRef.current.get(r.id)
    if (!url) {
      url = URL.createObjectURL(r.blob)
      urlsRef.current.set(r.id, url)
    }
    return url
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unsupported')
      return
    }
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const durationMs = Date.now() - startTimeRef.current
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        void saveRecording(songId, blob, durationMs).then(setRecordings)
      }
      mediaRecorderRef.current = mr
      startTimeRef.current = Date.now()
      mr.start()
      setElapsedMs(0)
      setStatus('recording')
      timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 200)
    } catch {
      setStatus('denied')
    }
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

  return (
    <div className="recorder">
      <p className="hint small">
        Grava o que você tocar pelo microfone do aparelho, para reescutar depois — útil pra treinar um trecho ou comparar tentativas.
        Fica só neste aparelho; as 5 gravações mais recentes ficam guardadas, as mais antigas somem sozinhas.
      </p>

      <div className="row">
        {status !== 'recording' ? (
          <button className="btn primary" onClick={() => void startRecording()} disabled={status === 'starting'}>
            {status === 'starting' ? 'preparando…' : '⏺ gravar'}
          </button>
        ) : (
          <button className="btn recording" onClick={stopRecording}>■ parar · {formatDuration(elapsedMs)}</button>
        )}
      </div>
      {status === 'denied' && <p className="hint danger">Não consegui acessar o microfone. Confira a permissão nas configurações do navegador ou do app.</p>}
      {status === 'unsupported' && <p className="hint danger">Este navegador não sabe gravar áudio.</p>}

      <h4>Gravações desta música</h4>
      {recordings === null && <p className="hint small">Carregando…</p>}
      {recordings !== null && recordings.length === 0 && <p className="hint small">Nenhuma gravação ainda.</p>}
      <div className="recordlist">
        {recordings?.map((r) => (
          <div key={r.id} className="recorditem">
            <div className="recorditem-meta">
              <strong>{formatDate(r.createdAt)}</strong>
              <span>{formatDuration(r.durationMs)}</span>
            </div>
            <audio controls src={urlFor(r)} preload="none" />
            <button className="icon small danger" onClick={() => void remove(r.id)}>apagar</button>
          </div>
        ))}
      </div>
    </div>
  )
}
