import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { guessKey, parseCifra, uniqueChords } from '../cifra/parse'
import { ImportCancelledError, importFromCifraClubUrl, isCifraClubUrl, nativeImportAvailable } from '../native/cifraClubImport'
import { nameOf } from '../theory/notes'
import { allVoicings } from '../theory/voicings'
import { useToast } from './Toast'

export function ImportView({ onImport, onCancel, initialUrl }: {
  onImport: (data: { title: string; artist: string; source: string | null; raw: string }) => void
  onCancel: () => void
  /** vem do compartilhamento do Android: preenche e dispara a importação sozinha */
  initialUrl?: string | null
}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [source, setSource] = useState('')
  const [raw, setRaw] = useState('')
  const showToast = useToast()

  const preview = useMemo(() => {
    if (!raw.trim()) return null
    const p = parseCifra(raw)
    const chords = uniqueChords(p)
    return {
      chords,
      chordLines: p.lines.filter((l) => l.kind === 'chords').length,
      lyricLines: p.lines.filter((l) => l.kind === 'lyrics').length,
      tabLines: p.lines.filter((l) => l.kind === 'tab').length,
      declaredKey: p.declaredKey,
      // só chuta o tom quando a cifra não declarou um no cabeçalho
      guessedKeyPc: p.declaredKey ? null : guessKey(p),
      capo: p.capo,
      // acordes que o app reconheceu mas não sabe tocar no violão dentro das
      // restrições de mão — melhor avisar aqui do que só depois de importado
      unplayable: chords.filter((c) => allVoicings(c.symbol, 1).length === 0).map((c) => c.symbol),
    }
  }, [raw])

  /** Chuta título/artista pelas duas primeiras linhas — usado ao colar, digitar ou carregar arquivo. */
  const guessMeta = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length >= 1) setTitle((cur) => cur || lines[0].slice(0, 80))
    if (lines.length >= 2) setArtist((cur) => cur || lines[1].slice(0, 60))
  }

  const nativeOk = nativeImportAvailable()
  const [linkUrl, setLinkUrl] = useState(initialUrl ?? '')
  const [linkStatus, setLinkStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const autoRan = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const runImportFromLink = async (url: string) => {
    if (!url.trim()) return
    setLinkStatus('loading')
    setLinkError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await importFromCifraClubUrl(url.trim(), 25000, controller.signal)
      setTitle(result.title)
      setArtist(result.artist)
      setSource(result.sourceUrl)
      setRaw(result.raw)
      setLinkStatus('idle')
    } catch (err) {
      if (err instanceof ImportCancelledError) {
        setLinkStatus('idle')
        return
      }
      setLinkStatus('error')
      setLinkError(err instanceof Error ? err.message : String(err))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const cancelImport = () => abortRef.current?.abort()

  // dispara sozinho quando o app é aberto por um compartilhamento
  useEffect(() => {
    if (initialUrl && !autoRan.current) {
      autoRan.current = true
      void runImportFromLink(initialUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl])

  return (
    <div className="importview">
      <header className="apphead">
        <button className="icon" onClick={onCancel} aria-label="Voltar"><ArrowLeftIcon /></button>
        <h1>Importar cifra</h1>
      </header>

      {nativeOk && (
        <div className="importlink">
          <strong>Importar por link do CifraClub</strong>
          <p className="hint small">
            Cole o link de uma música, ou use "Compartilhar" no Chrome / no app do CifraClub e escolha o cifrasGroup.
            O app abre a página como se você a estivesse visitando e lê a cifra sozinho — não precisa copiar nada.
          </p>
          <div className="row tight">
            <input
              className="linkinput"
              value={linkUrl}
              onChange={(e) => { setLinkUrl(e.target.value); if (linkStatus === 'error') { setLinkStatus('idle'); setLinkError(null) } }}
              placeholder="https://www.cifraclub.com.br/artista/musica/"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              className="btn primary"
              disabled={linkStatus === 'loading' || !isCifraClubUrl(linkUrl)}
              onClick={() => void runImportFromLink(linkUrl)}
            >
              {linkStatus === 'loading' ? 'importando…' : 'buscar'}
            </button>
            {linkStatus === 'loading' && (
              <button className="btn ghost" onClick={cancelImport}>cancelar</button>
            )}
          </div>
          {linkStatus === 'error' && linkError && <p className="hint linkerror">{linkError}</p>}
          {linkUrl && !isCifraClubUrl(linkUrl) && linkStatus !== 'loading' && (
            <p className="hint small">Esse link não parece ser de uma música do CifraClub.</p>
          )}
        </div>
      )}

      <div className="importhelp">
        <strong>{nativeOk ? 'Ou copie e cole manualmente' : 'Como trazer do CifraClub'}</strong>
        <ol>
          <li>Abra a música no site ou no app.</li>
          <li>Selecione a cifra inteira e copie (o texto já vem com os acordes alinhados).</li>
          <li>Cole no campo abaixo. O app detecta acordes, tablaturas, seções, tom e capotraste sozinho.</li>
        </ol>
        <p className="hint small">
          Também aceita ChordPro (<span className="mono">[C]colchetes na letra</span>) e arquivos <span className="mono">.txt</span>/<span className="mono">.cho</span>.
          A cifra fica só no seu aparelho.
        </p>
      </div>

      <div className="importform">
        <label className="field wide">Título<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da música" /></label>
        <label className="field wide">Artista<input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Intérprete" /></label>
        <label className="field wide">Link da fonte (opcional)<input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://..." /></label>
        <label className="field wide">
          Cifra
          <textarea
            value={raw}
            rows={16}
            spellCheck={false}
            placeholder={'C           G\nletra da música aqui\n\nAm          F\ncontinua...'}
            onChange={(e) => setRaw(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (text && !raw) setTimeout(() => guessMeta(text), 0)
            }}
            onBlur={() => { if (raw) guessMeta(raw) }}
          />
        </label>
        <label className="btn ghost">
          {fileName ? `arquivo: ${fileName}` : 'carregar arquivo .txt / .cho'}
          <input type="file" accept=".txt,.cho,.chopro,.crd,text/plain" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => {
              const text = String(r.result)
              setRaw(text)
              setFileName(f.name)
              guessMeta(text)
              setTitle((cur) => cur || f.name.replace(/\.[^.]+$/, ''))
            }
            r.onerror = () => showToast(`Não consegui ler o arquivo "${f.name}".`)
            r.readAsText(f)
            e.target.value = ''
          }} />
        </label>
      </div>

      {preview && (
        <div className="importpreview">
          <h3>O que o app entendeu</h3>
          <ul>
            <li><strong>{preview.chords.length}</strong> acordes diferentes em <strong>{preview.chordLines}</strong> linhas de acorde</li>
            <li><strong>{preview.lyricLines}</strong> linhas de letra · <strong>{preview.tabLines}</strong> linhas de tablatura {preview.tabLines > 0 && <em>(serão escondidas por padrão)</em>}</li>
            {preview.declaredKey && <li>tom declarado: <span className="mono">{preview.declaredKey}</span></li>}
            {preview.guessedKeyPc !== null && (
              <li>tom provável: <span className="mono">{nameOf(preview.guessedKeyPc)}</span> <em>(chute pela fundamental mais frequente; não declarado na cifra)</em></li>
            )}
            {preview.capo !== null && <li>capotraste na {preview.capo}ª casa</li>}
          </ul>
          <div className="mono chordpreview">{preview.chords.map((c) => `${c.symbol}×${c.count}`).join('  ')}</div>
          {preview.chords.length === 0 && (
            <p className="hint">Nenhum acorde reconhecido. Confira se a cifra tem os acordes em linhas próprias acima da letra.</p>
          )}
          {preview.unplayable.length > 0 && (
            <p className="hint warn">
              Sem digitação viável no violão dentro das restrições de mão: <span className="mono">{preview.unplayable.join(', ')}</span>.
              A simplificação automática pode resolver isso depois de importar.
            </p>
          )}
        </div>
      )}

      <div className="importactions">
        <button className="btn ghost" onClick={onCancel}>cancelar</button>
        <button
          className="btn primary"
          disabled={!raw.trim() || !title.trim()}
          onClick={() => onImport({ title: title.trim(), artist: artist.trim(), source: source.trim() || null, raw })}
        >
          importar
        </button>
      </div>
    </div>
  )
}
