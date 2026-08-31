import { Fragment } from 'react'
import { cleanChordToken, tokenize } from '../../cifra/parse'
import { isChordToken } from '../../theory/chord'

/**
 * Editor de marcação manual de acordes: mostra a cifra token por token para o
 * usuário apontar palavras que o parser não reconheceu como acorde (ex.: uma
 * notação incomum). Não depende da classificação de linha (chords/letra) do
 * parser — cada token da cifra é clicável, então dá pra marcar um acorde
 * mesmo numa linha hoje inteira classificada como letra.
 */
export function ChordMarker({ raw, manualChordTokens, onToggle }: {
  raw: string
  manualChordTokens: Set<string>
  onToggle: (token: string) => void
}) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')

  return (
    <div className="font-mono text-[.92rem] leading-[1.9] [overflow-wrap:anywhere]">
      <p className="font-sans text-[.78rem] text-dim leading-normal mb-3">
        Toque numa palavra que deveria ser um acorde e não foi reconhecida. Acordes já
        reconhecidos aparecem em laranja; os marcados manualmente ficam com contorno tracejado.
      </p>
      {lines.map((line, i) => {
        const tokens = tokenize(line)
        if (tokens.length === 0) return <div key={i} className="min-h-[1em]">&nbsp;</div>
        return (
          <div key={i} className="whitespace-pre-wrap">
            {tokens.map((t, j) => {
              const clean = cleanChordToken(t.token)
              const auto = isChordToken(t.token) || isChordToken(clean)
              const manual = manualChordTokens.has(t.token) || manualChordTokens.has(clean)
              return (
                <Fragment key={j}>
                  {j > 0 && ' '}
                  <button
                    type="button"
                    className={`bg-none border-0 p-0 font-inherit rounded-sm ${
                      auto
                        ? 'text-accent font-bold cursor-default'
                        : manual
                          ? 'text-accent font-bold border-b-2 border-dashed border-accent'
                          : 'text-fg hover:bg-bg3'
                    }`}
                    disabled={auto}
                    aria-pressed={manual}
                    aria-label={auto ? `${t.token} (já reconhecido como acorde)` : manual ? `${t.token} (marcado manualmente como acorde, toque para desmarcar)` : `Marcar "${t.token}" como acorde`}
                    onClick={() => onToggle(clean || t.token)}
                  >
                    {t.token}
                  </button>
                </Fragment>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
