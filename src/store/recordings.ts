/**
 * Gravações de prática por música — áudio ou vídeo (Blob), guardadas no mesmo
 * IndexedDB do resto do app (store/idb.ts), sob uma chave própria por música.
 * Fica separado do documento principal (store/db.ts) para não engordar o
 * JSON salvo a cada mudança de configuração.
 *
 * Sem limite de quantidade: quem quiser empilhar tomadas de ensaio guarda
 * quantas quiser. O marcador "guardada" (`pinned`) vira só um destaque visual
 * para achar as tomadas boas no meio de muitas, sem efeito automático.
 */
import { idbDelete, idbGet, idbSet } from './idb'

export type RecordingKind = 'audio' | 'video'

export interface Recording {
  id: string
  createdAt: number
  durationMs: number
  blob: Blob
  kind: RecordingKind
  /** destaque visual pra achar as tomadas boas no meio de muitas — sem efeito automático */
  pinned?: boolean
  /** ids das gravações de áudio que tocaram junto durante esta captura (empilhamento) */
  layeredOver?: string[]
}

function keyFor(songId: string): string {
  return `cifrasgroup:recordings:${songId}`
}

function newRecId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export async function listRecordings(songId: string): Promise<Recording[]> {
  const list = (await idbGet<Recording[]>(keyFor(songId))) ?? []
  // backfill: gravações salvas antes de existir vídeo/empilhamento eram todas áudio
  return list.map((r) => ({ ...r, kind: r.kind ?? 'audio' }))
}

/** Salva uma gravação nova, mais recente primeiro. */
export async function saveRecording(
  songId: string,
  blob: Blob,
  durationMs: number,
  kind: RecordingKind,
  layeredOver?: string[],
): Promise<Recording[]> {
  const list = await listRecordings(songId)
  const rec: Recording = {
    id: newRecId(),
    createdAt: Date.now(),
    durationMs,
    blob,
    kind,
    ...(layeredOver && layeredOver.length > 0 ? { layeredOver } : {}),
  }
  const next = [rec, ...list]
  await idbSet(keyFor(songId), next)
  return next
}

export async function deleteRecording(songId: string, id: string): Promise<Recording[]> {
  const next = (await listRecordings(songId)).filter((r) => r.id !== id)
  await idbSet(keyFor(songId), next)
  return next
}

/** Marca/desmarca uma gravação como guardada (destaque visual). */
export async function togglePinned(songId: string, id: string): Promise<Recording[]> {
  const next = (await listRecordings(songId)).map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r))
  await idbSet(keyFor(songId), next)
  return next
}

/** Apaga todas as gravações da música — usado quando a música em si é apagada. */
export async function deleteAllRecordings(songId: string): Promise<void> {
  await idbDelete(keyFor(songId))
}

/** Repõe uma lista de gravações (usado para desfazer a exclusão da música e ao restaurar backup). */
export async function restoreRecordings(songId: string, list: Recording[]): Promise<void> {
  if (list.length === 0) return
  await idbSet(keyFor(songId), list)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
