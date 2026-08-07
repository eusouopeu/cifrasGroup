/**
 * Recebe links compartilhados de outros apps (Chrome, app do CifraClub) via
 * o menu "Compartilhar" do Android. O plugin já resolve tanto o caso de o
 * app estar aberto quanto o de ser aberto pelo próprio compartilhamento —
 * nesse segundo caso ele guarda o evento até o listener ser registrado.
 */

import { Capacitor } from '@capacitor/core'
import { CapacitorShareTarget } from '@capgo/capacitor-share-target'

const URL_RE = /https?:\/\/\S+/i

/** Extrai a primeira URL de um texto compartilhado (pode vir com texto ao redor). */
function extractUrl(text: string): string | null {
  const m = URL_RE.exec(text)
  return m ? m[0].replace(/[)\].,;]+$/, '') : null
}

/** Registra o listener. Chame uma vez, no início do app. Retorna a função de limpeza. */
export function initShareTarget(onUrlShared: (url: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  const handle = CapacitorShareTarget.addListener('shareReceived', (event) => {
    for (const text of event.texts) {
      const url = extractUrl(text)
      if (url) {
        onUrlShared(url)
        return
      }
    }
  })

  return () => {
    handle.then((h) => h.remove())
  }
}
