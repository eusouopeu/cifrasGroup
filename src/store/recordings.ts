/**
 * Gravações de prática por música — áudio bruto (Blob) gravado pelo microfone,
 * guardado no mesmo IndexedDB do resto do app (store/idb.ts), sob uma chave
 * própria por música. Fica separado do documento principal (store/db.ts) para
 * não engordar o JSON salvo a cada mudança de configuração.
 *
 * Só as últimas gravações de cada música são mantidas — sem limite o
 * histórico de ensaios cresceria sem controle. O descarte nunca é silencioso:
 * `saveRecording` devolve o que foi jogado fora para a tela avisar, e uma
 * gravação marcada como guardada (`pinned`) fica de fora do descarte.
 */
import { idbDelete, idbGet, idbSet } from './idb'

export interface Recording {
  id: string
  createdAt: number
  durationMs: number
  blob: Blob
  /** guardada pelo usuário: não entra no descarte automático pelo limite */
  pinned?: boolean
}

export const MAX_PER_SONG = 5

function keyFor(songId: string): string {
  return `cifrasgroup:recordings:${songId}`
}

function newRecId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export async function listRecordings(songId: string): Promise<Recording[]> {
  return (await idbGet<Recording[]>(keyFor(songId))) ?? []
}

/**
 * Aplica o limite: as mais novas ficam, e as guardadas nunca saem. Se o
 * usuário guardar mais gravações que o limite, todas continuam — a marcação
 * dele vale mais que o teto.
 */
function prune(list: Recording[]): { kept: Recording[]; discarded: Recording[] } {
  const kept: Recording[] = []
  const discarded: Recording[] = []
  let unpinnedKept = 0
  const pinnedCount = list.filter((r) => r.pinned).length
  const budget = Math.max(0, MAX_PER_SONG - pinnedCount)
  for (const r of list) {
    if (r.pinned) { kept.push(r); continue }
    if (unpinnedKept < budget) { kept.push(r); unpinnedKept++ }
    else discarded.push(r)
  }
  return { kept, discarded }
}

export interface SaveResult {
  list: Recording[]
  /** gravações antigas descartadas por causa do limite — a tela avisa o usuário */
  discarded: Recording[]
}

/** Salva uma gravação nova, mais recente primeiro; descarta as excedentes ao limite. */
export async function saveRecording(songId: string, blob: Blob, durationMs: number): Promise<SaveResult> {
  const list = await listRecordings(songId)
  const rec: Recording = { id: newRecId(), createdAt: Date.now(), durationMs, blob }
  const { kept, discarded } = prune([rec, ...list])
  await idbSet(keyFor(songId), kept)
  return { list: kept, discarded }
}

export async function deleteRecording(songId: string, id: string): Promise<Recording[]> {
  const next = (await listRecordings(songId)).filter((r) => r.id !== id)
  await idbSet(keyFor(songId), next)
  return next
}

/** Marca/desmarca uma gravação como guardada (fora do descarte automático). */
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
