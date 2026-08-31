/**
 * Backup automático semanal, silencioso, só no app nativo (Capacitor) — o app
 * é 100% local, então um aparelho perdido/quebrado sem backup manual recente
 * significa perder a biblioteca inteira. Guarda em Documentos/CifrasGroup/Backups,
 * mantendo só os 3 mais recentes.
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { buildBackup } from './backup'
import type { DB } from './db'

const FOLDER = 'CifrasGroup/Backups'
const LAST_RUN_KEY = 'cifrasgroup:lastAutoBackupAt'
const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const KEEP = 3

function backupFilename(): string {
  return `backup-automatico-${new Date().toISOString().slice(0, 10)}.json`
}

export async function maybeRunAutoBackup(db: DB): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (Object.keys(db.songs).length === 0) return
  const last = Number(localStorage.getItem(LAST_RUN_KEY) || 0)
  if (Date.now() - last < INTERVAL_MS) return

  try {
    const text = await buildBackup(db)
    await Filesystem.writeFile({
      path: `${FOLDER}/${backupFilename()}`,
      directory: Directory.Documents,
      data: text,
      encoding: Encoding.UTF8,
      recursive: true,
    })
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()))

    const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents })
    const backups = files.filter((f) => f.name.startsWith('backup-automatico-')).sort((a, b) => (a.name < b.name ? 1 : -1))
    for (const f of backups.slice(KEEP)) {
      await Filesystem.deleteFile({ path: `${FOLDER}/${f.name}`, directory: Directory.Documents })
    }
  } catch {
    // backup automático não deve interromper o uso do app
  }
}
