import { useMemo, useState } from 'react'
import { parseCifra, uniqueChords } from '../cifra/parse'

export function ImportView({ onImport, onCancel }: {
  onImport: (data: { title: string; artist: string; source: string | null; raw: string }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [source, setSource] = useState('')
  const [raw, setRaw] = useState('')

  const preview = useMemo(() => {
    if (!raw.trim()) return null
    const p = parseCifra(raw)
    return {
      chords: uniqueChords(p),
      chordLines: p.lines.filter((l) => l.kind === 'chords').length,
      lyricLines: p.lines.filter((l) => l.kind === 'lyrics').length,
      tabLines: p.lines.filter((l) => l.kind === 'tab').length,
      declaredKey: p.declaredKey,
      capo: p.capo,
    }
  }, [raw])

  const guessMeta = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length >= 1 && !title) setTitle(lines[0].slice(0, 80))
    if (lines.length >= 2 && !artist) setArtist(lines[1].slice(0, 60))
  }

  return (
    <div className="importview">
      <header className="apphead">
        <button className="icon" onClick={onCancel}>←</button>
        <h1>Importar cifra</h1>
      </header>

      <div className="importhelp">
        <strong>Como trazer do CifraClub</strong>
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
          />
        </label>
        <label className="btn ghost">
          carregar arquivo .txt / .cho
          <input type="file" accept=".txt,.cho,.chopro,.crd,text/plain" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => {
              const text = String(r.result)
              setRaw(text)
              if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
            }
            r.readAsText(f)
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
            {preview.capo !== null && <li>capotraste na {preview.capo}ª casa</li>}
          </ul>
          <div className="mono chordpreview">{preview.chords.map((c) => `${c.symbol}×${c.count}`).join('  ')}</div>
          {preview.chords.length === 0 && (
            <p className="hint">Nenhum acorde reconhecido. Confira se a cifra tem os acordes em linhas próprias acima da letra.</p>
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
