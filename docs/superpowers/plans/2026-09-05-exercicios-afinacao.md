# Exercícios/jogos de ouvido (estilo SoundGym) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova aba "Exercícios" (padrão/primeira da tab pill de Afinação) com 5 jogos de treino de ouvido: EQ, pan, delay, compressão e reconhecimento de acordes.

**Architecture:** Motor genérico de exercícios (`src/exercises/`): tipos comuns (`Round`, `ExerciseDef`), progresso persistido em localStorage por jogo, uma tela de jogo genérica (`ExercisePlay.tsx`) parametrizada, e um arquivo pequeno por jogo que só gera a rodada (parâmetros + áudio). Jogos de efeito (EQ/pan/delay/compressão) reaproveitam um motor de áudio compartilhado (`audioEffects.ts`) sobre um loop sintetizado com `pluckNote`; acordes reaproveita `pluckNote` direto sem efeito.

**Tech Stack:** TypeScript, React, Tailwind, Heroicons, Web Audio API nativa (`BiquadFilterNode`, `StereoPannerNode`, `DelayNode`, `DynamicsCompressorNode`), Vitest.

**Spec:** [docs/superpowers/specs/2026-09-05-exercicios-afinacao-design.md](../specs/2026-09-05-exercicios-afinacao-design.md)

## Global Constraints

- TypeScript, Tailwind, Heroicons (`@heroicons/react/24/outline`; `/24/solid` só pra estado ativo) — nunca Lucide.
- Ícone sem regra de tamanho no CSS renderiza gigante — dar tamanho explícito (`className="w-5 h-5"` ou dentro de `.icon`/`.tabbar-item`).
- Qualquer CSS novo em `src/styles.css` vai dentro do bloco `@layer components` existente — CSS solto fora do layer é ignorado por overrides.
- Reaproveitar classes existentes (`.btn`, `.chip`, `.field`, `.hint`, `.panel-section`, `.apphead`, `.toggle`) em vez de criar padrões visuais novos.
- Só 3 testes automatizados nesta rodada (orçamento do projeto): progresso (level up/down), tolerância de slider (EQ), geração de rodada de múltipla escolha (acordes). Os outros 3 jogos (pan, delay, compressão) não ganham teste dedicado — verificação é manual via preview do navegador.
- Sem microfone em nenhum jogo — só reprodução de áudio sintetizado.
- Ao final, seguir a rotina do projeto: `npm run check` passando, commit + push pra `main`, gerar APK de debug e enviar ao usuário.

---

### Task 1: Tipos, progresso e pontuação por tolerância

**Files:**
- Create: `src/exercises/types.ts`
- Create: `src/exercises/progress.ts`
- Create: `src/exercises/scoring.ts`
- Test: `src/exercises/progress.test.ts`

**Interfaces:**
- Produces: `AnswerMode = 'choice' | 'slider'`, `RoundSound { id: string; label: string; play: () => void }`, `RoundChoice { id: string; label: string }`, `Round { sounds: RoundSound[]; answerMode: AnswerMode; choices?: RoundChoice[]; correctChoiceId?: string; sliderMin?: number; sliderMax?: number; sliderLabel?: (value: number) => string; correctValue?: number; tolerance?: number }`, `ExerciseDef { id: string; title: string; icon: ComponentType<{ className?: string }>; generateRound: (level: number) => Round }` (todos em `types.ts`)
- Produces: `GameProgress { level: number; streak: number; totalCorrect: number; totalAttempts: number }`, `DEFAULT_GAME_PROGRESS`, `loadGameProgress(gameId: string): GameProgress`, `saveGameProgress(gameId: string, progress: GameProgress): void`, `applyRoundResult(progress: GameProgress, correct: boolean): GameProgress` (em `progress.ts`)
- Produces: `isWithinTolerance(guess: number, correct: number, tolerance: number): boolean` (em `scoring.ts`)

- [ ] **Step 1: Criar `src/exercises/types.ts`**

```ts
import type { ComponentType } from 'react'

export type AnswerMode = 'choice' | 'slider'

export interface RoundSound {
  id: string
  label: string
  play: () => void
}

export interface RoundChoice {
  id: string
  label: string
}

export interface Round {
  sounds: RoundSound[]
  answerMode: AnswerMode
  // modo 'choice'
  choices?: RoundChoice[]
  correctChoiceId?: string
  // modo 'slider'
  sliderMin?: number
  sliderMax?: number
  sliderLabel?: (value: number) => string
  correctValue?: number
  tolerance?: number
}

export interface ExerciseDef {
  id: string
  title: string
  icon: ComponentType<{ className?: string }>
  generateRound: (level: number) => Round
}
```

- [ ] **Step 2: Escrever teste de progresso (falhando)**

Criar `src/exercises/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyRoundResult, DEFAULT_GAME_PROGRESS } from './progress'

describe('applyRoundResult', () => {
  it('3 acertos seguidos sobe 1 nível e zera a sequência', () => {
    let p = DEFAULT_GAME_PROGRESS
    p = applyRoundResult(p, true)
    p = applyRoundResult(p, true)
    expect(p.level).toBe(1)
    p = applyRoundResult(p, true)
    expect(p.level).toBe(2)
    expect(p.streak).toBe(0)
    expect(p.totalCorrect).toBe(3)
    expect(p.totalAttempts).toBe(3)
  })

  it('um erro desce 1 nível (sem passar de 1) e zera a sequência', () => {
    const p = applyRoundResult({ level: 1, streak: 2, totalCorrect: 5, totalAttempts: 6 }, false)
    expect(p.level).toBe(1)
    expect(p.streak).toBe(0)
    expect(p.totalAttempts).toBe(7)
  })
})
```

- [ ] **Step 3: Rodar teste, confirmar que falha**

Run: `npx vitest run src/exercises/progress.test.ts`
Expected: FAIL — `progress.ts` não existe ainda.

- [ ] **Step 4: Criar `src/exercises/progress.ts`**

```ts
/**
 * Nível, sequência e histórico de cada jogo de exercício, lembrados entre
 * visitas — uma chave de localStorage por jogo, no padrão de store/libraryPrefs.ts:
 * lida campo a campo pra um valor corrompido/ausente não quebrar a tela.
 */
export interface GameProgress {
  level: number
  streak: number
  totalCorrect: number
  totalAttempts: number
}

export const DEFAULT_GAME_PROGRESS: GameProgress = { level: 1, streak: 0, totalCorrect: 0, totalAttempts: 0 }

const MIN_LEVEL = 1
const MAX_LEVEL = 5
const STREAK_TO_LEVEL_UP = 3

function keyFor(gameId: string): string {
  return `cifrasgroup:exerciseProgress:${gameId}`
}

export function parseGameProgress(raw: string | null): GameProgress {
  if (!raw) return DEFAULT_GAME_PROGRESS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_GAME_PROGRESS
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_GAME_PROGRESS
  const o = data as Record<string, unknown>
  const num = (v: unknown, fallback: number, min: number, max = Infinity): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
  return {
    level: num(o.level, DEFAULT_GAME_PROGRESS.level, MIN_LEVEL, MAX_LEVEL),
    streak: num(o.streak, DEFAULT_GAME_PROGRESS.streak, 0),
    totalCorrect: num(o.totalCorrect, 0, 0),
    totalAttempts: num(o.totalAttempts, 0, 0),
  }
}

export function loadGameProgress(gameId: string): GameProgress {
  try {
    return parseGameProgress(localStorage.getItem(keyFor(gameId)))
  } catch {
    return DEFAULT_GAME_PROGRESS
  }
}

export function saveGameProgress(gameId: string, progress: GameProgress): void {
  try {
    localStorage.setItem(keyFor(gameId), JSON.stringify(progress))
  } catch {
    // modo privado / cota cheia: perder o progresso é aceitável, quebrar a tela não
  }
}

/** Aplica o resultado de uma rodada e devolve o progresso atualizado (não persiste). */
export function applyRoundResult(progress: GameProgress, correct: boolean): GameProgress {
  const totalAttempts = progress.totalAttempts + 1
  const totalCorrect = progress.totalCorrect + (correct ? 1 : 0)
  if (!correct) {
    return { level: Math.max(MIN_LEVEL, progress.level - 1), streak: 0, totalCorrect, totalAttempts }
  }
  const streak = progress.streak + 1
  if (streak >= STREAK_TO_LEVEL_UP) {
    return { level: Math.min(MAX_LEVEL, progress.level + 1), streak: 0, totalCorrect, totalAttempts }
  }
  return { ...progress, streak, totalCorrect, totalAttempts }
}
```

- [ ] **Step 5: Rodar teste, confirmar que passa**

Run: `npx vitest run src/exercises/progress.test.ts`
Expected: PASS

- [ ] **Step 6: Criar `src/exercises/scoring.ts`**

```ts
/** Acerto de resposta em slider: valor dentro de `tolerance` do valor correto. */
export function isWithinTolerance(guess: number, correct: number, tolerance: number): boolean {
  return Math.abs(guess - correct) <= tolerance
}
```

- [ ] **Step 7: Commit**

```bash
git add src/exercises/types.ts src/exercises/progress.ts src/exercises/progress.test.ts src/exercises/scoring.ts
git commit -m "$(cat <<'EOF'
feat: motor de progresso e tolerância dos exercícios de ouvido

Base compartilhada pelos 5 jogos: nível/sequência persistidos por
jogo em localStorage e checagem genérica de acerto por tolerância
(usada pelos jogos de resposta em slider).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Jogo de reconhecer acordes

**Files:**
- Create: `src/exercises/games/chords.ts`
- Test: `src/exercises/games/chords.test.ts`

**Interfaces:**
- Consumes: `pluckNote(freq: number, seconds?: number, destination?: AudioNode): void` de `src/audio/pluck.ts`; `midiToFreq(midi: number): number` de `src/theory/tunings.ts`; `ExerciseDef`, `Round` de `../types`
- Produces: `CHORD_QUALITIES: ChordQuality[]`, `pickChordRound(level: number, rng?: () => number): ChordRoundData`, `chordsGame: ExerciseDef`

- [ ] **Step 1: Escrever teste da lógica pura (falhando)**

Criar `src/exercises/games/chords.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, pickChordRound } from './chords'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

describe('pickChordRound', () => {
  it('opção correta sempre está entre as opções, sem duplicatas', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { correct, options } = pickChordRound(1, seeded(seed))
      expect(options.some((o) => o.id === correct.id)).toBe(true)
      expect(new Set(options.map((o) => o.id)).size).toBe(options.length)
    }
  })

  it('número de opções cresce com o nível, até o total de qualidades', () => {
    expect(pickChordRound(1, seeded(1)).options.length).toBe(5)
    expect(pickChordRound(4, seeded(1)).options.length).toBe(8)
    expect(pickChordRound(10, seeded(1)).options.length).toBe(CHORD_QUALITIES.length)
  })
})
```

- [ ] **Step 2: Rodar teste, confirmar que falha**

Run: `npx vitest run src/exercises/games/chords.test.ts`
Expected: FAIL — `chords.ts` não existe.

- [ ] **Step 3: Implementar `src/exercises/games/chords.ts`**

```ts
import { MusicalNoteIcon } from '@heroicons/react/24/outline'
import { pluckNote } from '../../audio/pluck'
import { midiToFreq } from '../../theory/tunings'
import type { ExerciseDef, Round } from '../types'

export interface ChordQuality {
  id: string
  label: string
  intervals: number[]
}

export const CHORD_QUALITIES: ChordQuality[] = [
  { id: 'maj', label: 'Maior', intervals: [0, 4, 7] },
  { id: 'min', label: 'Menor', intervals: [0, 3, 7] },
  { id: 'dim', label: 'Diminuto', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Aumentado', intervals: [0, 4, 8] },
  { id: 'maj7', label: '7ª maior', intervals: [0, 4, 7, 11] },
  { id: '7', label: '7ª (dominante)', intervals: [0, 4, 7, 10] },
  { id: 'm7b5', label: 'Meio-diminuto', intervals: [0, 3, 6, 10] },
  { id: 'dim7', label: 'Diminuto com 7ª', intervals: [0, 3, 6, 9] },
]

const CHORD_ROOT_MIDI = 60 // C4

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface ChordRoundData {
  rootPc: number
  correct: ChordQuality
  options: ChordQuality[]
}

/** Nível controla quantas qualidades entram como opção (mín. 5, todas as 8 a partir do nível 4). */
export function pickChordRound(level: number, rng: () => number = Math.random): ChordRoundData {
  const numOptions = Math.min(4 + level, CHORD_QUALITIES.length)
  const rootPc = Math.floor(rng() * 12)
  const correct = CHORD_QUALITIES[Math.floor(rng() * CHORD_QUALITIES.length)]
  const pool = CHORD_QUALITIES.filter((q) => q.id !== correct.id)
  const distractors: ChordQuality[] = []
  while (distractors.length < numOptions - 1 && pool.length > 0) {
    distractors.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  const options = shuffle([correct, ...distractors], rng)
  return { rootPc, correct, options }
}

export const chordsGame: ExerciseDef = {
  id: 'chords',
  title: 'Reconhecer acordes',
  icon: MusicalNoteIcon,
  generateRound(level): Round {
    const { rootPc, correct, options } = pickChordRound(level)
    const play = () => correct.intervals.forEach((iv) => pluckNote(midiToFreq(CHORD_ROOT_MIDI + rootPc + iv), 1.6))
    return {
      answerMode: 'choice',
      sounds: [{ id: 'chord', label: 'Tocar acorde', play }],
      choices: options.map((q) => ({ id: q.id, label: q.label })),
      correctChoiceId: correct.id,
    }
  },
}
```

- [ ] **Step 4: Rodar teste, confirmar que passa**

Run: `npx vitest run src/exercises/games/chords.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/exercises/games/chords.ts src/exercises/games/chords.test.ts
git commit -m "$(cat <<'EOF'
feat: jogo de reconhecer acordes nos exercícios de ouvido

Toca tríade/tétrade sorteada entre 8 qualidades (maior, menor, dim,
aum, maj7, 7, m7b5, dim7) via pluckNote; nível controla quantas
qualidades aparecem como opção de resposta.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Motor de áudio compartilhado + jogo de EQ

**Files:**
- Modify: `src/audio/pluck.ts` (linha ~19 e ~47-58 — ver abaixo)
- Create: `src/exercises/audioEffects.ts`
- Create: `src/exercises/games/eq.ts`
- Test: `src/exercises/games/eq.test.ts`

**Interfaces:**
- Consumes: `pluckNote`, `audioContext` (agora exportado) de `../../audio/pluck`; `isWithinTolerance` de `../scoring`
- Produces: `playLoop(effect?: (ctx: AudioContext) => AudioNode): void` (em `audioEffects.ts`); `pickEqRound(level: number, rng?: () => number): EqRoundData`, `eqGame: ExerciseDef` (em `games/eq.ts`)

- [ ] **Step 1: Modificar `src/audio/pluck.ts` — exportar contexto e aceitar destino opcional**

Trocar (linha ~19):
```ts
function audioContext(): AudioContext {
```
por:
```ts
export function audioContext(): AudioContext {
```

Trocar (linhas ~47-58):
```ts
export function pluckNote(freq: number, seconds = 1.8): void {
  const ac = audioContext()
  if (ac.state === 'suspended') void ac.resume()
  const src = ac.createBufferSource()
  src.buffer = karplusStrong(ac, freq, seconds)
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = Math.min(ac.sampleRate / 2 - 1000, freq * 12)
  const gain = ac.createGain()
  gain.gain.value = 0.9
  src.connect(tone).connect(gain).connect(ac.destination)
  src.start()
}
```
por:
```ts
/** `destination` custom: usado pelos exercícios de ouvido pra rotear o pluck por um nó de efeito antes da saída. */
export function pluckNote(freq: number, seconds = 1.8, destination?: AudioNode): void {
  const ac = audioContext()
  if (ac.state === 'suspended') void ac.resume()
  const src = ac.createBufferSource()
  src.buffer = karplusStrong(ac, freq, seconds)
  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = Math.min(ac.sampleRate / 2 - 1000, freq * 12)
  const gain = ac.createGain()
  gain.gain.value = 0.9
  src.connect(tone).connect(gain).connect(destination ?? ac.destination)
  src.start()
}
```

- [ ] **Step 2: Rodar typecheck (sem teste dedicado — mudança é passagem de parâmetro opcional, chamadas existentes continuam válidas)**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Criar `src/exercises/audioEffects.ts`**

```ts
/**
 * Loop de referência dos jogos de EQ/pan/delay/compressão: uma tríade maior
 * simples tocada via pluckNote, opcionalmente roteada por um nó de efeito
 * antes da saída — assim cada jogo só precisa descrever o nó de efeito.
 */
import { audioContext, pluckNote } from '../audio/pluck'

const LOOP_ROOT_FREQ = 220 // A3
const LOOP_INTERVALS = [0, 4, 7]
const LOOP_NOTE_SECONDS = 2.2

export function playLoop(effect?: (ctx: AudioContext) => AudioNode): void {
  const ac = audioContext()
  const node = effect ? effect(ac) : null
  if (node) node.connect(ac.destination)
  const destination = node ?? ac.destination
  for (const semitones of LOOP_INTERVALS) {
    pluckNote(LOOP_ROOT_FREQ * Math.pow(2, semitones / 12), LOOP_NOTE_SECONDS, destination)
  }
}
```

- [ ] **Step 4: Escrever teste da lógica pura do EQ (falhando)**

Criar `src/exercises/games/eq.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isWithinTolerance } from '../scoring'
import { EQ_FREQ_MAX, EQ_FREQ_MIN, pickEqRound } from './eq'

describe('pickEqRound', () => {
  it('frequência sorteada fica dentro da faixa audível configurada', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = () => (seed + 0.5) / 20
      const { freqHz } = pickEqRound(1, rng)
      expect(freqHz).toBeGreaterThanOrEqual(EQ_FREQ_MIN)
      expect(freqHz).toBeLessThanOrEqual(EQ_FREQ_MAX)
    }
  })

  it('tolerância aperta conforme o nível sobe', () => {
    const t1 = pickEqRound(1, () => 0.5).tolerance
    const t5 = pickEqRound(5, () => 0.5).tolerance
    expect(t5).toBeLessThan(t1)
  })
})

describe('isWithinTolerance', () => {
  it('aceita dentro da margem, rejeita fora', () => {
    expect(isWithinTolerance(10, 10.4, 0.5)).toBe(true)
    expect(isWithinTolerance(10, 11, 0.5)).toBe(false)
  })
})
```

- [ ] **Step 5: Rodar teste, confirmar que falha**

Run: `npx vitest run src/exercises/games/eq.test.ts`
Expected: FAIL — `eq.ts` não existe.

- [ ] **Step 6: Implementar `src/exercises/games/eq.ts`**

```ts
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

export const EQ_FREQ_MIN = 20
export const EQ_FREQ_MAX = 20000

const GAIN_DB_BY_LEVEL: Record<number, number> = { 1: 12, 2: 9, 3: 6, 4: 4.5, 5: 3 }
const TOLERANCE_OCTAVES_BY_LEVEL: Record<number, number> = { 1: 1, 2: 0.75, 3: 0.5, 4: 0.35, 5: 0.25 }

function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, level))
}

export interface EqRoundData {
  freqHz: number
  gainDb: number
  tolerance: number
}

export function pickEqRound(level: number, rng: () => number = Math.random): EqRoundData {
  const l = clampLevel(level)
  const minLog = Math.log2(EQ_FREQ_MIN)
  const maxLog = Math.log2(EQ_FREQ_MAX)
  const freqHz = Math.pow(2, minLog + rng() * (maxLog - minLog))
  return { freqHz, gainDb: GAIN_DB_BY_LEVEL[l], tolerance: TOLERANCE_OCTAVES_BY_LEVEL[l] }
}

function buildEqEffect(freqHz: number, gainDb: number) {
  return (ctx: AudioContext): AudioNode => {
    const filter = ctx.createBiquadFilter()
    filter.type = 'peaking'
    filter.frequency.value = freqHz
    filter.Q.value = 1
    filter.gain.value = gainDb
    return filter
  }
}

export const eqGame: ExerciseDef = {
  id: 'eq',
  title: 'Identificar EQ',
  icon: AdjustmentsHorizontalIcon,
  generateRound(level): Round {
    const { freqHz, gainDb, tolerance } = pickEqRound(level)
    return {
      answerMode: 'slider',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com EQ)', play: () => playLoop(buildEqEffect(freqHz, gainDb)) },
      ],
      sliderMin: Math.log2(EQ_FREQ_MIN),
      sliderMax: Math.log2(EQ_FREQ_MAX),
      sliderLabel: (v) => `${Math.round(Math.pow(2, v))} Hz`,
      correctValue: Math.log2(freqHz),
      tolerance,
    }
  },
}
```

- [ ] **Step 7: Rodar teste, confirmar que passa**

Run: `npx vitest run src/exercises/games/eq.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/audio/pluck.ts src/exercises/audioEffects.ts src/exercises/games/eq.ts src/exercises/games/eq.test.ts
git commit -m "$(cat <<'EOF'
feat: motor de áudio compartilhado e jogo de EQ nos exercícios de ouvido

pluckNote ganha destino opcional pra poder ser roteado por um nó de
efeito Web Audio (BiquadFilterNode etc.) — base pros 4 jogos de
efeito. EQ é o primeiro: usuário aponta num slider (escala log) a
frequência que foi realçada/cortada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Jogo de pan

**Files:**
- Create: `src/exercises/games/pan.ts`

**Interfaces:**
- Consumes: `playLoop` de `../audioEffects`; `ExerciseDef`, `Round` de `../types`
- Produces: `panGame: ExerciseDef`

- [ ] **Step 1: Implementar `src/exercises/games/pan.ts`**

```ts
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

const TOLERANCE_BY_LEVEL: Record<number, number> = { 1: 0.4, 2: 0.325, 3: 0.25, 4: 0.175, 5: 0.1 }

function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, level))
}

function buildPanEffect(pan: number) {
  return (ctx: AudioContext): AudioNode => {
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    return panner
  }
}

export const panGame: ExerciseDef = {
  id: 'pan',
  title: 'Identificar pan',
  icon: ArrowsRightLeftIcon,
  generateRound(level): Round {
    const l = clampLevel(level)
    const pan = Math.random() * 2 - 1
    return {
      answerMode: 'slider',
      sounds: [
        { id: 'dry', label: 'Tocar A (centro)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com pan)', play: () => playLoop(buildPanEffect(pan)) },
      ],
      sliderMin: -1,
      sliderMax: 1,
      sliderLabel: (v) => (Math.abs(v) < 0.05 ? 'Centro' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'esquerda' : 'direita'}`),
      correctValue: pan,
      tolerance: TOLERANCE_BY_LEVEL[l],
    }
  },
}
```

- [ ] **Step 2: Verificação manual**

Sem teste dedicado (orçamento de 3 testes já usado — ver Global Constraints). Verificar visualmente no preview do navegador na Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/exercises/games/pan.ts
git commit -m "$(cat <<'EOF'
feat: jogo de identificar pan nos exercícios de ouvido

Mesmo motor de áudio compartilhado do EQ, com StereoPannerNode;
resposta em slider de -1 (esquerda) a 1 (direita).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Jogo de delay

**Files:**
- Create: `src/exercises/games/delay.ts`

**Interfaces:**
- Consumes: `playLoop` de `../audioEffects`; `ExerciseDef`, `Round` de `../types`
- Produces: `delayGame: ExerciseDef`

- [ ] **Step 1: Implementar `src/exercises/games/delay.ts`**

```ts
import { ClockIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

interface DelayOption {
  id: string
  label: string
  ms: number
}

const OPTIONS_LEVEL_1: DelayOption[] = [
  { id: '80', label: 'Curto (~80ms)', ms: 80 },
  { id: '250', label: 'Médio (~250ms)', ms: 250 },
  { id: '500', label: 'Longo (~500ms)', ms: 500 },
]

const OPTIONS_LEVEL_3: DelayOption[] = [
  { id: '80', label: '~80ms', ms: 80 },
  { id: '150', label: '~150ms', ms: 150 },
  { id: '250', label: '~250ms', ms: 250 },
  { id: '350', label: '~350ms', ms: 350 },
  { id: '500', label: '~500ms', ms: 500 },
]

function optionsForLevel(level: number): DelayOption[] {
  return level >= 3 ? OPTIONS_LEVEL_3 : OPTIONS_LEVEL_1
}

function buildDelayEffect(ms: number, feedbackAmount: number) {
  return (ctx: AudioContext): AudioNode => {
    const delay = ctx.createDelay(1)
    delay.delayTime.value = ms / 1000
    const feedback = ctx.createGain()
    feedback.gain.value = feedbackAmount
    delay.connect(feedback)
    feedback.connect(delay)
    return delay
  }
}

export const delayGame: ExerciseDef = {
  id: 'delay',
  title: 'Identificar delay',
  icon: ClockIcon,
  generateRound(level): Round {
    const options = optionsForLevel(level)
    const correct = options[Math.floor(Math.random() * options.length)]
    const feedbackAmount = level >= 3 ? 0.2 : 0.35
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com delay)', play: () => playLoop(buildDelayEffect(correct.ms, feedbackAmount)) },
      ],
      choices: options.map((o) => ({ id: o.id, label: o.label })),
      correctChoiceId: correct.id,
    }
  },
}
```

- [ ] **Step 2: Verificação manual** (sem teste dedicado, ver Task 4 Step 2)

- [ ] **Step 3: Commit**

```bash
git add src/exercises/games/delay.ts
git commit -m "$(cat <<'EOF'
feat: jogo de identificar delay nos exercícios de ouvido

Múltipla escolha entre tempos de delay (DelayNode + realimentação);
nível 3+ aperta pra opções mais próximas e mix mais sutil.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Jogo de compressão

**Files:**
- Create: `src/exercises/games/compression.ts`

**Interfaces:**
- Consumes: `playLoop` de `../audioEffects`; `ExerciseDef`, `Round` de `../types`
- Produces: `compressionGame: ExerciseDef`

- [ ] **Step 1: Implementar `src/exercises/games/compression.ts`**

```ts
import { ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import { playLoop } from '../audioEffects'
import type { ExerciseDef, Round } from '../types'

interface CompressionOption {
  id: string
  label: string
  ratio: number
  threshold: number
}

const OPTIONS_LEVEL_1: CompressionOption[] = [
  { id: 'leve', label: 'Leve', ratio: 2, threshold: -18 },
  { id: 'medio', label: 'Médio', ratio: 6, threshold: -24 },
  { id: 'pesado', label: 'Pesado', ratio: 14, threshold: -30 },
]

const OPTIONS_LEVEL_3: CompressionOption[] = [
  { id: 'leve', label: 'Leve', ratio: 2, threshold: -16 },
  { id: 'leve-medio', label: 'Leve-médio', ratio: 4, threshold: -20 },
  { id: 'medio', label: 'Médio', ratio: 6, threshold: -24 },
  { id: 'medio-pesado', label: 'Médio-pesado', ratio: 9, threshold: -27 },
  { id: 'pesado', label: 'Pesado', ratio: 14, threshold: -30 },
]

function optionsForLevel(level: number): CompressionOption[] {
  return level >= 3 ? OPTIONS_LEVEL_3 : OPTIONS_LEVEL_1
}

function buildCompressionEffect(ratio: number, threshold: number) {
  return (ctx: AudioContext): AudioNode => {
    const comp = ctx.createDynamicsCompressor()
    comp.ratio.value = ratio
    comp.threshold.value = threshold
    comp.knee.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.15
    return comp
  }
}

export const compressionGame: ExerciseDef = {
  id: 'compression',
  title: 'Identificar compressão',
  icon: ArrowsPointingInIcon,
  generateRound(level): Round {
    const options = optionsForLevel(level)
    const correct = options[Math.floor(Math.random() * options.length)]
    return {
      answerMode: 'choice',
      sounds: [
        { id: 'dry', label: 'Tocar A (original)', play: () => playLoop() },
        { id: 'wet', label: 'Tocar B (com compressão)', play: () => playLoop(buildCompressionEffect(correct.ratio, correct.threshold)) },
      ],
      choices: options.map((o) => ({ id: o.id, label: o.label })),
      correctChoiceId: correct.id,
    }
  },
}
```

- [ ] **Step 2: Verificação manual** (sem teste dedicado, ver Task 4 Step 2)

- [ ] **Step 3: Commit**

```bash
git add src/exercises/games/compression.ts
git commit -m "$(cat <<'EOF'
feat: jogo de identificar compressão nos exercícios de ouvido

Múltipla escolha entre níveis de ratio/threshold (DynamicsCompressorNode);
nível 3+ aperta pra 5 opções com diferenças menores entre si.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Tela de jogo genérica e lista de exercícios

**Files:**
- Create: `src/exercises/games/index.ts`
- Create: `src/exercises/ExercisePlay.tsx`
- Create: `src/exercises/ExercisesTab.tsx`

**Interfaces:**
- Consumes: `ExerciseDef`, `Round` de `./types`; `GameProgress`, `loadGameProgress`, `saveGameProgress`, `applyRoundResult` de `./progress`; `isWithinTolerance` de `./scoring`; `chordsGame`, `eqGame`, `panGame`, `delayGame`, `compressionGame` de `./games/*`
- Produces: `EXERCISE_GAMES: ExerciseDef[]` (em `games/index.ts`); componentes `ExercisePlay`, `ExercisesTab`

- [ ] **Step 1: Criar `src/exercises/games/index.ts`**

```ts
import type { ExerciseDef } from '../types'
import { chordsGame } from './chords'
import { compressionGame } from './compression'
import { delayGame } from './delay'
import { eqGame } from './eq'
import { panGame } from './pan'

export const EXERCISE_GAMES: ExerciseDef[] = [chordsGame, eqGame, panGame, delayGame, compressionGame]
```

- [ ] **Step 2: Criar `src/exercises/ExercisePlay.tsx`**

```tsx
import { useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { applyRoundResult, loadGameProgress, saveGameProgress, type GameProgress } from './progress'
import { isWithinTolerance } from './scoring'
import type { ExerciseDef, Round } from './types'

export function ExercisePlay({ def, onBack }: { def: ExerciseDef; onBack: () => void }) {
  const [progress, setProgress] = useState<GameProgress>(() => loadGameProgress(def.id))
  const [round, setRound] = useState<Round>(() => def.generateRound(loadGameProgress(def.id).level))
  const [sliderValue, setSliderValue] = useState(() => round.sliderMin ?? 0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const answered = feedback !== null

  const nextRound = (level: number) => {
    const r = def.generateRound(level)
    setRound(r)
    setSliderValue(r.sliderMin ?? 0)
    setFeedback(null)
  }

  const answer = (correct: boolean) => {
    const updated = applyRoundResult(progress, correct)
    setProgress(updated)
    saveGameProgress(def.id, updated)
    setFeedback(correct ? 'correct' : 'wrong')
  }

  return (
    <div className="panel-section">
      <div className="apphead">
        <button className="icon" onClick={onBack} aria-label="Voltar"><ArrowLeftIcon /></button>
        <h1 className="flex-1">{def.title}</h1>
        <span className="chip">Nível {progress.level}</span>
        <span className="chip">Sequência {progress.streak}</span>
      </div>

      <div className="flex gap-2 mb-3">
        {round.sounds.map((s) => (
          <button key={s.id} className="btn" onClick={s.play}>{s.label}</button>
        ))}
      </div>

      {round.answerMode === 'choice' && (
        <div className="flex flex-col gap-1.5">
          {round.choices!.map((c) => (
            <button
              key={c.id}
              className={`btn wide${answered && c.id === round.correctChoiceId ? ' primary' : ''}`}
              disabled={answered}
              onClick={() => answer(c.id === round.correctChoiceId)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {round.answerMode === 'slider' && (
        <div className="field wide">
          <label>{round.sliderLabel ? round.sliderLabel(sliderValue) : sliderValue.toFixed(2)}</label>
          <input
            type="range"
            min={round.sliderMin}
            max={round.sliderMax}
            step={((round.sliderMax ?? 1) - (round.sliderMin ?? 0)) / 200}
            value={sliderValue}
            disabled={answered}
            onChange={(e) => setSliderValue(Number(e.target.value))}
          />
          {!answered && (
            <button
              className="btn primary"
              onClick={() => answer(isWithinTolerance(sliderValue, round.correctValue ?? 0, round.tolerance ?? 0))}
            >
              Confirmar
            </button>
          )}
        </div>
      )}

      {feedback && (
        <p className="hint">
          {feedback === 'correct' ? 'Acertou!' : 'Errou.'}
          {round.answerMode === 'slider' && round.sliderLabel && (
            <> Valor certo: <strong>{round.sliderLabel(round.correctValue ?? 0)}</strong>, sua resposta: <strong>{round.sliderLabel(sliderValue)}</strong>.</>
          )}
        </p>
      )}

      {answered && (
        <button className="btn primary wide" onClick={() => nextRound(progress.level)}>Próxima</button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/exercises/ExercisesTab.tsx`**

```tsx
import { useState } from 'react'
import { ExercisePlay } from './ExercisePlay'
import { EXERCISE_GAMES } from './games'
import { loadGameProgress } from './progress'

export function ExercisesTab() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = EXERCISE_GAMES.find((g) => g.id === activeId) ?? null

  if (active) return <ExercisePlay def={active} onBack={() => setActiveId(null)} />

  return (
    <div className="panel-section">
      <div className="flex flex-col gap-1.5">
        {EXERCISE_GAMES.map((g) => {
          const progress = loadGameProgress(g.id)
          const Icon = g.icon
          return (
            <button key={g.id} className="btn wide stacked" onClick={() => setActiveId(g.id)}>
              <span className="flex items-center gap-2"><Icon className="w-5 h-5" />{g.title}</span>
              <span className="hint small">Nível {progress.level} · sequência atual {progress.streak}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/exercises/games/index.ts src/exercises/ExercisePlay.tsx src/exercises/ExercisesTab.tsx
git commit -m "$(cat <<'EOF'
feat: tela de jogo genérica e lista dos 5 exercícios de ouvido

ExercisePlay é parametrizada por ExerciseDef — cobre múltipla
escolha e slider com a mesma tela (tocar A/B, responder, feedback,
próxima rodada). ExercisesTab lista os 5 jogos com nível/sequência.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Ligar na aba Afinação, verificar no navegador e publicar

**Files:**
- Modify: `src/components/TunerTab.tsx`

**Interfaces:**
- Consumes: `ExercisesTab` de `../exercises/ExercisesTab`

- [ ] **Step 1: Modificar `src/components/TunerTab.tsx`**

Trocar:
```ts
import { VoiceLabTab } from './song/VoiceLab'
import { tuningById, type Tuning } from '../theory/tunings'

type Tab = 'afinacao' | 'voz'
```
por:
```ts
import { VoiceLabTab } from './song/VoiceLab'
import { ExercisesTab } from '../exercises/ExercisesTab'
import { tuningById, type Tuning } from '../theory/tunings'

type Tab = 'exercicios' | 'afinacao' | 'voz'
```

Trocar:
```ts
  const [tab, setTab] = useState<Tab>('afinacao')
```
por:
```ts
  const [tab, setTab] = useState<Tab>('exercicios')
```

Trocar:
```tsx
      <div className="toggle flex w-full mb-3 [&>button]:flex-1">
        <button className={tab === 'afinacao' ? 'on' : ''} onClick={() => setTab('afinacao')}>Afinação</button>
        <button className={tab === 'voz' ? 'on' : ''} onClick={() => setTab('voz')}>Voz</button>
      </div>

      {tab === 'afinacao' && (
```
por:
```tsx
      <div className="toggle flex w-full mb-3 [&>button]:flex-1">
        <button className={tab === 'exercicios' ? 'on' : ''} onClick={() => setTab('exercicios')}>Exercícios</button>
        <button className={tab === 'afinacao' ? 'on' : ''} onClick={() => setTab('afinacao')}>Afinação</button>
        <button className={tab === 'voz' ? 'on' : ''} onClick={() => setTab('voz')}>Voz</button>
      </div>

      {tab === 'exercicios' && <ExercisesTab />}

      {tab === 'afinacao' && (
```

- [ ] **Step 2: Rodar typecheck e testes completos**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros, todos os testes (incluindo os 3 novos) passando.

- [ ] **Step 3: Rodar `npm run check` (lint + demais checagens do projeto)**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Verificar no navegador**

Abrir preview (`npm run dev`), ir na aba Afinação, confirmar que "Exercícios" abre por padrão, testar 1 rodada de cada um dos 5 jogos (tocar A/B ou tocar acorde, responder, ver feedback e nível/sequência atualizando), checar tema claro/escuro.

- [ ] **Step 5: Commit, push e gerar APK de debug**

```bash
git add src/components/TunerTab.tsx
git commit -m "$(cat <<'EOF'
feat: aba Exercícios como padrão da tab pill de Afinação

Liga os 5 jogos de ouvido (EQ, pan, delay, compressão, acordes) na
aba Afinação, antes das abas Afinação e Voz — pedido do usuário pra
abrir direto nos exercícios.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

Depois, gerar o APK conforme a rotina do projeto (`npm run build && npx cap sync android`, então `assembleDebug` com `JAVA_HOME` do `openjdk@21`) e enviar `android/app/build/outputs/apk/debug/app-debug.apk` ao usuário via SendUserFile.

---

## Self-Review

**Cobertura da spec:** navegação/aba padrão (Task 8), estrutura de arquivos (Tasks 1-7 seguem exatamente a árvore da spec), progresso/nível (Task 1), motor de áudio (Task 3), os 5 jogos com suas mecânicas (Tasks 2, 3, 4, 5, 6), tela genérica com slider/choice (Task 7), estilo reaproveitando classes existentes (todas as tasks), 3 testes essenciais (Tasks 1, 2, 3), fora de escopo respeitado (nenhuma task usa áudio embutido, backend ou outros jogos). Sem lacunas.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo passo de código tem o código completo.

**Consistência de tipos:** `Round.sounds`/`answerMode`/`choices`/`correctChoiceId`/`sliderMin`/`sliderMax`/`sliderLabel`/`correctValue`/`tolerance` definidos na Task 1 e usados com os mesmos nomes em todas as tasks seguintes; `ExerciseDef.generateRound(level: number): Round` idêntico em todos os jogos; `GameProgress` e `applyRoundResult`/`loadGameProgress`/`saveGameProgress` usados com a mesma assinatura em `ExercisePlay.tsx` e `ExercisesTab.tsx`.
