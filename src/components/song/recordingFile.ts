/** Extensão de arquivo a partir do mime type gravado pelo MediaRecorder. */
export function extensionFor(mime: string, kind: 'audio' | 'video'): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return kind === 'video' ? 'webm' : 'webm'
}

function formatDateForFilename(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

/** Nome de arquivo para uma gravação: "<música> - <título ou data>.<ext>". */
export function recordingFilename(songTitle: string, label: string, createdAt: number, mime: string, kind: 'audio' | 'video'): string {
  const ext = extensionFor(mime, kind)
  const base = label || formatDateForFilename(createdAt)
  return `${songTitle ? `${songTitle} - ` : ''}${base}.${ext}`
}
