/**
 * Arquivo de backup do app.
 *
 * A versão 1 era o próprio documento do IndexedDB (músicas + listas) serializado.
 * Só que as gravações de prática vivem em chaves separadas (store/recordings.ts)
 * e ficavam de fora: quem trocava de aparelho perdia todas achando que tinha
 * backup. A versão 2 embrulha o mesmo documento e leva junto as gravações,
 * codificadas em base64 (JSON não carrega binário).
 *
 * Arquivos v1 continuam sendo aceitos na importação — são lidos como um backup
 * sem gravações.
 */

import { exportDB, importDB, type DB } from './db'
import { listRecordings, restoreRecordings, type Recording, type RecordingKind } from './recordings'

interface SerializedRecording {
  id: string
  createdAt: number
  durationMs: number
  kind?: RecordingKind
  pinned?: boolean
  layeredOver?: string[]
  title?: string
  mime: string
  /** conteúdo do áudio/vídeo em base64 */
  data: string
}

interface BackupFileV2 {
  format: 'cifrasgroup-backup'
  version: 2
  db: DB
  /** gravações por id de música */
  recordings: Record<string, SerializedRecording[]>
}

export interface Backup {
  db: DB
  recordings: Record<string, Recording[]>
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const url = String(r.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Monta o texto do arquivo de backup, com as gravações de todas as músicas. */
export async function buildBackup(db: DB): Promise<string> {
  const recordings: Record<string, SerializedRecording[]> = {}
  for (const id of Object.keys(db.songs)) {
    const list = await listRecordings(id)
    if (list.length === 0) continue
    recordings[id] = await Promise.all(
      list.map(async (r) => ({
        id: r.id,
        createdAt: r.createdAt,
        durationMs: r.durationMs,
        kind: r.kind,
        pinned: r.pinned,
        layeredOver: r.layeredOver,
        title: r.title,
        mime: r.blob.type || (r.kind === 'video' ? 'video/webm' : 'audio/webm'),
        data: await blobToBase64(r.blob),
      })),
    )
  }
  const file: BackupFileV2 = { format: 'cifrasgroup-backup', version: 2, db, recordings }
  return JSON.stringify(file)
}

/** Lê um arquivo de backup (v2 ou o formato antigo, que era só o banco). */
export function parseBackup(json: string): Backup | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const maybe = parsed as Partial<BackupFileV2>
  if (maybe && maybe.format === 'cifrasgroup-backup' && maybe.db) {
    const db = importDB(JSON.stringify(maybe.db))
    if (!db) return null
    const recordings: Record<string, Recording[]> = {}
    for (const [songId, list] of Object.entries(maybe.recordings ?? {})) {
      recordings[songId] = list.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        durationMs: r.durationMs,
        kind: r.kind ?? 'audio',
        pinned: r.pinned,
        layeredOver: r.layeredOver,
        title: r.title,
        blob: base64ToBlob(r.data, r.mime),
      }))
    }
    return { db, recordings }
  }
  // formato antigo: o documento do banco, sem gravações
  const legacy = importDB(json)
  return legacy ? { db: legacy, recordings: {} } : null
}

/** Quantas gravações o arquivo traz — para avisar o usuário antes de aplicar. */
export function countRecordings(backup: Backup): number {
  return Object.values(backup.recordings).reduce((n, list) => n + list.length, 0)
}

/**
 * Grava as gravações do backup nas músicas correspondentes já dentro da
 * biblioteca. `idMap` traduz o id que a música tinha no backup para o id que
 * ela ficou tendo aqui (a mesclagem cria ids novos para evitar colisão).
 */
export async function restoreBackupRecordings(backup: Backup, idMap: Map<string, string>): Promise<void> {
  for (const [oldId, list] of Object.entries(backup.recordings)) {
    const target = idMap.get(oldId) ?? oldId
    const existing = await listRecordings(target)
    const known = new Set(existing.map((r) => r.id))
    const merged = [...existing, ...list.filter((r) => !known.has(r.id))].sort((a, b) => b.createdAt - a.createdAt)
    await restoreRecordings(target, merged)
  }
}

/** Backup só do documento (sem gravações) — usado no snapshot automático antes de importar. */
export function quickBackupText(db: DB): string {
  return exportDB(db)
}
