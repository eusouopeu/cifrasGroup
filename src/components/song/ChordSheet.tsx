/**
 * Ficha do acorde: construção nota a nota, digitações e troca manual.
 *
 * As digitações aparecem uma por vez, num carrossel: mostrar as seis de uma vez
 * enchia a tela de diagramas quase iguais e empurrava para baixo o que o usuário
 * abriu a ficha para fazer — trocar o acorde. Uma por vez também deixa cada
 * diagrama grande o bastante para ser lido a um braço de distância.
 *
 * "Versões mais fáceis" e "Trocar manualmente" vivem em abas da mesma pílula,
 * não uma embaixo da outra: eram duas listas de botões empilhadas que
 * sobrecarregavam a tela de uma vez só. Escolher uma opção em qualquer uma
 * das duas não fecha a ficha — dá pra comparar mais de uma antes de decidir.
 */
import { useState } from 'react'
import { ArrowUturnLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { chordQualityName, chordSpelling, parseChord } from '../../theory/chord'
import { nameOf } from '../../theory/notes'
import { simplifyChord } from '../../theory/simplify'
import type { Tuning } from '../../theory/tunings'
import { allVoicings, voicingFingerprint } from '../../theory/voicings'
import { GuitarDiagram, PianoDiagram } from '../ChordDiagram'

/** Quantas digitações o carrossel oferece — mais que isso vira repetição de formas quase iguais. */
const MAX_VOICINGS = 12

type Tab = 'facil' | 'manual'

export function ChordSheet({ symbol, instrument, threshold, tuning, isOverridden, preferredFingerprint, onPick, onReset, onPreferVoicing, onClose }: {
  symbol: string
  instrument: 'guitar' | 'piano'
  threshold: number
  tuning: Tuning
  /** true quando este acorde já foi trocado à mão — só então faz sentido desfazer */
  isOverridden: boolean
  /** impressão digital (voicingFingerprint) da digitação escolhida para a faixa de acordes desta música, se houver */
  preferredFingerprint?: string
  onPick: (s: string) => void
  onReset: () => void
  /** marca uma digitação como a que a faixa de acordes deve mostrar para este acorde, só nesta música */
  onPreferVoicing: (fingerprint: string) => void
  onClose: () => void
}) {
  const chord = parseChord(symbol)
  const voicings = allVoicings(symbol, MAX_VOICINGS, tuning.strings)
  const sub = simplifyChord(symbol, threshold)
  const spelling = chord ? chordSpelling(chord) : []
  const [tab, setTab] = useState<Tab>(sub ? 'facil' : 'manual')
  // "construção mais simples" é redundante nesta seção — o card já mostra o
  // acorde mais simples por definição; o motivo só interessa quando é sobre
  // dificuldade no violão ou mudança do baixo
  const primaryReason = sub?.reason.split(' · ').filter((r) => r !== 'construção mais simples').join(' · ')

  return (
    <div className="chordfloat">
      <div className="sheet-head">
        <h3 className="mono">{symbol}</h3>
        <button className="icon" onClick={onClose} aria-label="Fechar ficha do acorde"><XMarkIcon /></button>
      </div>
      {chord && (
        <>
          <p className="hint">
            Fundamental <strong>{nameOf(chord.rootPc)}</strong> · {chordQualityName(chord)}
            {chord.bassPc !== null && chord.bassPc !== chord.rootPc && <> · baixo em <strong>{nameOf(chord.bassPc)}</strong></>}
          </p>
          <div className="spelling">
            {spelling.map((n) => (
              <span key={n.interval} className="degree">
                <b>{n.note}</b>
                <i>{n.label}</i>
              </span>
            ))}
          </div>
        </>
      )}

      {instrument === 'piano' ? (
        <div className="sheet-piano"><PianoDiagram symbol={symbol} size={1.4} /></div>
      ) : (
        <VoicingCarousel
          key={`voicing-${symbol}`}
          symbol={symbol}
          voicings={voicings}
          tuning={tuning}
          preferredFingerprint={preferredFingerprint}
          onPreferVoicing={onPreferVoicing}
        />
      )}

      <div className="toggle chordsheet-tabs">
        <button className={tab === 'facil' ? 'on' : ''} onClick={() => setTab('facil')}>Versões mais fáceis</button>
        <button className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>Trocar manualmente</button>
      </div>

      {tab === 'facil' && (
        sub ? (
          <div className="altlist">
            <button className="alt" onClick={() => onPick(sub.to)}>
              <span className="mono">{sub.to}</span>
              <span>{Math.round(sub.score * 100)}% igual{primaryReason ? ` · ${primaryReason}` : ''}</span>
              {(sub.lost.length > 0 || sub.added.length > 0) && (
                <span className="degrees">
                  {sub.lost.length > 0 && <>perde {sub.lost.join(', ')}</>}
                  {sub.lost.length > 0 && sub.added.length > 0 && ' · '}
                  {sub.added.length > 0 && <>ganha {sub.added.join(', ')}</>}
                </span>
              )}
            </button>
            {sub.alternatives.map((a) => (
              <button key={a.symbol} className="alt" onClick={() => onPick(a.symbol)}>
                <span className="mono">{a.symbol}</span>
                <span>{Math.round(a.score * 100)}% igual</span>
                {(a.lost.length > 0 || a.added.length > 0) && (
                  <span className="degrees">
                    {a.lost.length > 0 && <>perde {a.lost.join(', ')}</>}
                    {a.lost.length > 0 && a.added.length > 0 && ' · '}
                    {a.added.length > 0 && <>ganha {a.added.join(', ')}</>}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint small">Nenhuma troca sugerida para este acorde neste limiar de semelhança.</p>
        )
      )}

      {tab === 'manual' && (
        <ManualPicker key={`manual-${symbol}`} current={symbol} isOverridden={isOverridden} onPick={onPick} onReset={onReset} />
      )}
    </div>
  )
}

/**
 * Digitações uma a uma, com setas — a ordem já é da mais fácil para a mais
 * difícil. Tocar na própria digitação a marca como a que a faixa de acordes
 * deve mostrar para este acorde nesta música (não muda nada em outras músicas).
 */
function VoicingCarousel({ symbol, voicings, tuning, preferredFingerprint, onPreferVoicing }: {
  symbol: string
  voicings: Voicings
  tuning: Tuning
  preferredFingerprint?: string
  onPreferVoicing: (fingerprint: string) => void
}) {
  const preferredIdx = preferredFingerprint ? voicings.findIndex((v) => voicingFingerprint(v) === preferredFingerprint) : -1
  const [idx, setIdx] = useState(Math.max(0, preferredIdx))
  if (voicings.length === 0) return <p className="hint">Nenhuma digitação viável dentro das restrições de mão.</p>
  const safe = Math.min(idx, voicings.length - 1)
  const v = voicings[safe]
  const fingerprint = voicingFingerprint(v)
  const isPreferred = fingerprint === preferredFingerprint

  return (
    <div className="voicing-carousel">
      <button
        className="icon"
        aria-label="Digitação anterior"
        disabled={voicings.length < 2}
        onClick={() => setIdx((i) => (i - 1 + voicings.length) % voicings.length)}
      >
        <ChevronLeftIcon />
      </button>
      <div className="voicing-carousel-main">
        <span className="voicing-carousel-count">{safe + 1} de {voicings.length}</span>
        <button
          className={`voicing-pick${isPreferred ? ' preferred' : ''}`}
          onClick={() => onPreferVoicing(fingerprint)}
          aria-label="Usar esta digitação na faixa de acordes desta música"
          title="Usar esta digitação na faixa de acordes desta música"
        >
          <GuitarDiagram symbol={symbol} voicing={v} size={1.3} tuning={tuning} />
        </button>
        <span className="voicing-meta">
          {v.barre !== null ? `pestana na ${v.barre}ª casa` : 'sem pestana'} · {v.open} solta{v.open === 1 ? '' : 's'} · {v.muted} muda{v.muted === 1 ? '' : 's'}
        </span>
        <span className="voicing-prefer-hint">
          {isPreferred ? (
            <><CheckIcon /> usada na faixa de acordes</>
          ) : (
            'toque na digitação para usá-la na faixa de acordes'
          )}
        </span>
      </div>
      <button
        className="icon"
        aria-label="Próxima digitação"
        disabled={voicings.length < 2}
        onClick={() => setIdx((i) => (i + 1) % voicings.length)}
      >
        <ChevronRightIcon />
      </button>
    </div>
  )
}

type Voicings = ReturnType<typeof allVoicings>

/** Sufixos oferecidos na troca manual — só os mais elaborados; os básicos
 *  (C, Cm, C7...) o usuário digita direto no campo de texto livre se precisar. */
const MANUAL_SUFFIXES = ['m(7M)', 'add9', 'm(add9)', 'dim', 'dim7', 'm7(b5)', 'aug', '7sus4', '7(9)', 'm7(9)', '7M(9)', '7(13)', '7(b9)', '7(#9)', 'm7(11)', '7M(#11)']

function ManualPicker({ current, isOverridden, onPick, onReset }: {
  current: string
  isOverridden: boolean
  onPick: (s: string) => void
  onReset: () => void
}) {
  const c = parseChord(current)
  const [freeText, setFreeText] = useState('')
  const freeParsed = freeText.trim() ? parseChord(freeText.trim()) : null
  const freeInvalid = freeText.trim().length > 0 && !freeParsed

  // As variantes são todas sobre a fundamental do próprio acorde: trocar a
  // fundamental aqui trocava a música de acorde, não de forma — para isso
  // existem a transposição da música inteira e o campo de texto livre.
  const root = c?.rootPc ?? 0
  // "natureza" = maior ou menor (diminuto conta como menor, já que tem 3ª menor).
  // As que mantêm a natureza do acorde original vêm primeiro; as que a trocam
  // vêm depois, marcadas em outra cor.
  const isMinorNature = (t: ReturnType<typeof parseChord>) => t?.triad === 'min' || t?.triad === 'dim'
  const originalIsMinor = isMinorNature(c)
  const sameNature: string[] = []
  const otherNature: string[] = []
  for (const suf of MANUAL_SUFFIXES) {
    const sym = nameOf(root) + suf
    ;(isMinorNature(parseChord(sym)) === originalIsMinor ? sameNature : otherNature).push(sym)
  }

  const submitFree = () => {
    if (!freeParsed) return
    onPick(freeText.trim())
    setFreeText('')
  }

  return (
    <div className="manual">
      <p className="hint small">
        Variantes de <span className="mono">{nameOf(root)}</span> — em verde as que mantêm maior/menor como no original, em vermelho as que trocam.
      </p>
      <div className="suffixrow">
        {sameNature.map((sym) => (
          <button key={sym} className="suffixbtn mono" onClick={() => onPick(sym)}>{sym}</button>
        ))}
        {otherNature.map((sym) => (
          <button key={sym} className="suffixbtn mono minor" onClick={() => onPick(sym)}>{sym}</button>
        ))}
      </div>
      <div className="freechord">
        <input
          className={`mono${freeInvalid ? ' invalid' : ''}`}
          placeholder="digitar outro acorde, ex.: F#7(#9)"
          aria-label="Digitar outro acorde"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitFree() }}
        />
        <button className="btn" disabled={!freeParsed} onClick={submitFree}>usar</button>
        <button
          className="icon undo-override"
          onClick={onReset}
          disabled={!isOverridden}
          aria-label="Desfazer troca manual deste acorde"
          title="Desfazer troca manual deste acorde"
        >
          <ArrowUturnLeftIcon />
        </button>
      </div>
      {freeInvalid && <p className="hint small danger">Não reconheci esse acorde.</p>}
    </div>
  )
}
