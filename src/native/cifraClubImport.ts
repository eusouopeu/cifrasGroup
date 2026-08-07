/**
 * Importação de uma cifra do CifraClub a partir do link, disponível só no app
 * nativo (Android/iOS via Capacitor).
 *
 * Mecanismo: abre a própria página num WebView oculto — a mesma página que
 * carregaria se você a visitasse normalmente, com os mesmos anúncios e o
 * mesmo JavaScript — e lê o conteúdo já renderizado do DOM. Não é um proxy:
 * é o seu aparelho acessando uma página que você pediu, uma de cada vez,
 * assim como aconteceria copiando manualmente. Nenhum servidor nosso vê essa
 * requisição.
 *
 * Não funciona no navegador: a mesma operação ali esbarraria em CORS (o
 * CifraClub não envia `Access-Control-Allow-Origin`). No app nativo a
 * requisição sai pela ponte nativa do Capacitor, fora do sandbox do browser.
 */

import { Capacitor } from '@capacitor/core'
import { InAppBrowser } from '@capgo/capacitor-inappbrowser'

export interface ImportedCifra {
  title: string
  artist: string
  raw: string
  sourceUrl: string
}

/** Lançado quando o usuário cancela a importação por link antes dela terminar. */
export class ImportCancelledError extends Error {
  constructor() {
    super('Importação cancelada.')
    this.name = 'ImportCancelledError'
  }
}

export function nativeImportAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export function isCifraClubUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /(^|\.)cifraclub\.com(\.br)?$/i.test(u.hostname) && u.pathname.split('/').filter(Boolean).length >= 2
  } catch {
    return false
  }
}

/**
 * Roda dentro da página do CifraClub.
 *
 * O CifraClub serve DOIS templates diferentes dependendo do User-Agent: o
 * desktop (h1.t1, h2.t3, .cifra_cnt pre, #cifra_tom, #cifra_capo —
 * confirmado em três músicas reais) e o mobile, que é uma SPA React com
 * classes CSS geradas por hash (ex.: _3mLVO) que mudam a cada deploy — só
 * um WebView de verdade recebe esse segundo, então foi preciso inspecionar
 * pelo Chrome DevTools Protocol contra o app rodando no emulador para achar
 * a estrutura real. Nela não existem os ids/classes do desktop; o que
 * sobrevive nos dois é: um único <pre> na página inteira, e o <title>
 * do documento no formato "Música - Artista - Cifra Club".
 *
 * O textContent do <pre> preserva o alinhamento de colunas entre acordes e
 * letra nos dois templates — é a mesma forma que o parser já lê no texto
 * colado manualmente.
 *
 * Só avisa o app quando encontra a cifra — se ainda não carregou, não faz
 * nada e deixa o lado de fora tentar de novo. Isso evita depender do evento
 * de "página carregada", que só dispara depois de anúncios e rastreadores
 * terminarem — bem mais lento que o conteúdo em si aparecer no DOM.
 */
const EXTRACTION_SCRIPT = `
(function () {
  try {
    var pre = document.querySelector('.cifra_cnt pre') || document.querySelector('#cifra pre') || document.querySelector('pre');
    if (!pre || !pre.textContent.trim()) return;

    function text(sel) {
      var el = document.querySelector(sel);
      return el ? el.textContent.trim() : '';
    }

    var title = text('h1.t1');
    var artist = text('h2.t3');
    var tom = text('#cifra_tom');
    var capo = text('#cifra_capo');

    if (!tom || !capo) {
      // template mobile: tom/capotraste não têm id próprio, aparecem como
      // texto nos irmãos do <pre> dentro de #cifra, antes dele no DOM.
      var scope = document.getElementById('cifra');
      var headerText = '';
      if (scope) {
        for (var i = 0; i < scope.childNodes.length; i++) {
          var node = scope.childNodes[i];
          if (node === pre || (node.nodeType === 1 && node.contains(pre))) break;
          headerText += (node.textContent || '') + ' ';
        }
      }
      if (!tom) {
        var tomMatch = /tom\\s*:?\\s*([A-G][#b]?m?(?:\\s*\\([^)]*\\))?)/i.exec(headerText);
        if (tomMatch) tom = 'Tom: ' + tomMatch[1].trim();
      }
      if (!capo) {
        var capoMatch = /capotraste[^.\\n]{0,40}/i.exec(headerText);
        if (capoMatch) capo = capoMatch[0].trim();
      }
    }

    if (!title || !artist) {
      // document.title funciona nos dois templates: "Música - Artista - Cifra Club"
      var parts = document.title.split(' - ');
      if (!title) title = (parts[0] || '').trim();
      if (!artist) artist = (parts[1] || '').trim();
    }

    var payload = { ok: true, title: title, artist: artist, tom: tom, capo: capo, cifra: pre.textContent };
    window.mobileApp.postMessage({ detail: payload });
  } catch (e) {
    window.mobileApp.postMessage({ detail: { ok: false, error: String(e && e.message || e) } });
  }
})();
`

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Payload {
  ok: boolean
  title?: string
  artist?: string
  tom?: string
  capo?: string
  cifra?: string
  error?: string
}

type Unsubscribe = Promise<{ remove: () => void }>

/**
 * Espera um evento do plugin cujo `id` combine com o do webview, com timeout.
 * Recebe a própria chamada de `addListener` já tipada corretamente pelo
 * chamador — os overloads de `InAppBrowser.addListener` não resolvem bem
 * quando o nome do evento é uma união genérica.
 */
function waitForEvent<T extends { id?: string }>(
  subscribe: (onEvent: (event: T) => void) => Unsubscribe,
  webviewId: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      void handle.then((h) => h.remove())
      reject(new Error('Tempo esgotado — a página não respondeu.'))
    }, timeoutMs)

    const handle = subscribe((event) => {
      if (settled) return
      if (event.id !== undefined && event.id !== webviewId) return
      settled = true
      window.clearTimeout(timer)
      void handle.then((h) => h.remove())
      resolve(event)
    })
  })
}

const POLL_MS = 400

/**
 * Importa uma cifra a partir do link. Lança erro com mensagem em português
 * pronta para exibir ao usuário em qualquer ponto de falha.
 */
export async function importFromCifraClubUrl(url: string, timeoutMs = 25000, signal?: AbortSignal): Promise<ImportedCifra> {
  if (!nativeImportAvailable()) {
    throw new Error('A importação por link só funciona no app instalado — no navegador, cole o texto da cifra.')
  }
  if (!isCifraClubUrl(url)) {
    throw new Error('Esse link não parece ser de uma música do CifraClub.')
  }
  if (signal?.aborted) throw new ImportCancelledError()

  const { id } = await InAppBrowser.openWebView({ url, hidden: true })

  const messagePromise = waitForEvent<{ id?: string; detail?: Record<string, unknown> }>(
    (cb) => InAppBrowser.addListener('messageFromWebview', (event) => cb(event)),
    id,
    timeoutMs,
  )
  const pageErrored = waitForEvent<{ id?: string }>((cb) => InAppBrowser.addListener('pageLoadError', cb), id, timeoutMs)
  // evita "unhandled rejection": o perdedor da corrida fica pendente até o
  // próprio timeout dele rejeitar, sem que ninguém mais esteja escutando.
  messagePromise.catch(() => {})
  pageErrored.catch(() => {})

  const cancelledPromise = signal
    ? new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(new ImportCancelledError()), { once: true })
      })
    : null
  cancelledPromise?.catch(() => {})

  // sonda o DOM em vez de esperar a página "terminar" — anúncios e
  // rastreadores de terceiros demoram bem mais que o conteúdo em si.
  const poll = () => void InAppBrowser.executeScript({ id, code: EXTRACTION_SCRIPT }).catch(() => {})
  poll()
  const pollTimer = window.setInterval(poll, POLL_MS)

  try {
    const race: Promise<{ id?: string; detail?: Record<string, unknown> }>[] = [
      messagePromise,
      pageErrored.then(() => {
        throw new Error('Não foi possível carregar a página.')
      }),
    ]
    if (cancelledPromise) race.push(cancelledPromise)
    const { detail } = await Promise.race(race)
    // a forma real vem de JS injetado em outra página; o TS não consegue
    // verificar isso estaticamente, então a validação é feita a seguir.
    const payload = (detail ?? { ok: false }) as unknown as Payload

    if (!payload.ok || !payload.cifra) {
      throw new Error(payload.error ? `Não consegui ler essa página (${payload.error}).` : 'Não encontrei uma cifra nessa página.')
    }

    const pathParts = new URL(url).pathname.split('/').filter(Boolean)
    const title = payload.title || titleFromSlug(pathParts[1] ?? 'Música')
    const artist = payload.artist || titleFromSlug(pathParts[0] ?? '')

    const header = [payload.tom, payload.capo].filter(Boolean).join('\n')
    const raw = (header ? header + '\n\n' : '') + payload.cifra

    return { title, artist, raw, sourceUrl: url }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Tempo esgotado')) {
      throw new Error('Não encontrei uma cifra nessa página — confira se o link é de uma música específica, não de um artista ou álbum.')
    }
    throw err
  } finally {
    window.clearInterval(pollTimer)
    await InAppBrowser.close({ id }).catch(() => {})
  }
}
