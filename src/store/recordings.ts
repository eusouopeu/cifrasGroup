/**
 * Gravações de prática por música — áudio bruto (Blob) gravado pelo microfone,
 * guardado no mesmo IndexedDB do resto do app (store/idb.ts), sob uma chave
 * própria por música. Fica separado do documento principal (store/db.ts) para
 * não engordar o JSON salvo a cada mudança de configuração.
 *
 * Só as últimas gravações de cada música são mantidas — sem limite o
 * histórico de ensaios cresceria sem controle.
 */
import { idbGet, idbSet } from './idb'

export interface Recording {
  id: string
  createdAt: number
  durationMs: number
  blob: Blob
}

const MAX_PER_SONG = 5

function keyFor(songId: string): string {
  return `cifrasgroup:recordings:${songId}`
}

function newRecId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export async function listRecordings(songId: string): Promise<Recording[]> {
  return (await idbGet<Recording[]>(keyFor(songId))) ?? []
}

/** Salva uma gravação nova, mais recente primeiro; descarta as excedentes ao limite. */
export async function saveRecording(songId: string, blob: Blob, durationMs: number): Promise<Recording[]> {
  const list = await listRecordings(songId)
  const rec: Recording = { id: newRecId(), createdAt: Date.now(), durationMs, blob }
  const next = [rec, ...list].slice(0, MAX_PER_SONG)
  await idbSet(keyFor(songId), next)
  return next
}

export async function deleteRecording(songId: string, id: string): Promise<Recording[]> {
  const next = (await listRecordings(songId)).filter((r) => r.id !== id)
  await idbSet(keyFor(songId), next)
  return next
}
