/**
 * Salva arquivos produzidos pelo app (cifra .txt, gravações de áudio/vídeo)
 * numa pasta própria do app dentro de Documentos do aparelho, em vez de um
 * download de navegador solto — que no WebView do app nativo não funciona
 * direito e não deixa o arquivo em lugar nenhum acessível pelo usuário.
 *
 * No navegador (dev/PWA, sem Capacitor nativo) não existe acesso a
 * filesystem: cai para o download comum como alternativa.
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

const APP_FOLDER = 'CifrasGroup'

export type AppFileKind = 'cifras' | 'audios' | 'videos'

const SUBFOLDER: Record<AppFileKind, string> = {
  cifras: 'Cifras',
  audios: 'Audios',
  videos: 'Videos',
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'arquivo'
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(((reader.result as string) || '').split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export interface SaveResult {
  savedToDevice: boolean
  /** caminho relativo dentro de Documentos, só quando salvo no aparelho */
  path?: string
}

/** Salva texto ou blob binário na pasta do app dentro de Documentos (nativo) ou baixa (navegador). */
export async function saveAppFile(kind: AppFileKind, filename: string, data: Blob | string): Promise<SaveResult> {
  const clean = sanitizeFilename(filename)
  const path = `${APP_FOLDER}/${SUBFOLDER[kind]}/${clean}`

  if (Capacitor.isNativePlatform()) {
    if (typeof data === 'string') {
      await Filesystem.writeFile({ path, directory: Directory.Documents, data, encoding: Encoding.UTF8, recursive: true })
    } else {
      const base64 = await blobToBase64(data)
      await Filesystem.writeFile({ path, directory: Directory.Documents, data: base64, recursive: true })
    }
    return { savedToDevice: true, path: `Documentos/${APP_FOLDER}/${SUBFOLDER[kind]}/${clean}` }
  }

  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = clean
  a.click()
  URL.revokeObjectURL(url)
  return { savedToDevice: false }
}
