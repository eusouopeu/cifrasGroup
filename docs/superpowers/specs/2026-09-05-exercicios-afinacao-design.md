# Exercícios/jogos de ouvido (estilo SoundGym) — design

Data: 2026-09-05

## Objetivo

Nova aba dentro da tab pill de Afinação (`TunerTab.tsx`), como aba padrão/primeira,
com jogos de treino de ouvido inspirados no SoundGym: EQ, pan, delay, compressão
e reconhecimento de acordes. Sem microfone — só reprodução de áudio sintetizado
e resposta do usuário (múltipla escolha ou slider).

## Navegação

`TunerTab.tsx`: pill passa de 2 para 3 abas, nesta ordem: `exercicios` (default),
`afinacao`, `voz`. `useState<Tab>('exercicios')`.

`ExercisesTab.tsx`: lista os 5 jogos como cards (ícone, nome, nível atual, streak
atual) reaproveitando padrões visuais existentes (`.chip`, `.panel-section`).
Toque num card abre `ExercisePlay.tsx` para aquele jogo.

## Estrutura de arquivos

```
src/exercises/
  types.ts          # ExerciseDef, Round, answerMode
  progress.ts        # localStorage: nível/streak/histórico por jogo
  audioEffects.ts     # grafo Web Audio genérico p/ eq/pan/delay/compressão
  games/
    eq.ts
    pan.ts
    delay.ts
    compression.ts
    chords.ts
  ExercisesTab.tsx
  ExercisePlay.tsx
```

## Tipos centrais (`types.ts`)

```ts
type AnswerMode = 'choice' | 'slider'

interface Round {
  playDry: () => void          // "Tocar A"
  playWet: () => void          // "Tocar B"
  answerMode: AnswerMode
  // modo 'choice'
  choices?: { id: string; label: string }[]
  correctChoiceId?: string
  // modo 'slider'
  sliderMin?: number
  sliderMax?: number
  sliderLog?: boolean          // true p/ EQ (frequência)
  sliderLabel?: (v: number) => string
  correctValue?: number
  tolerance?: number           // já ajustada ao nível atual
}

interface ExerciseDef {
  id: string
  title: string
  icon: ComponentType          // heroicon
  generateRound: (level: number) => Round
}
```

## Progresso (`progress.ts`)

localStorage, uma chave por jogo (`exercise:<id>`), lida campo a campo (padrão
de `store/libraryPrefs.ts` — valor corrompido/ausente não quebra a tela):

```ts
interface GameProgress {
  level: number       // começa em 1
  streak: number       // acertos seguidos atuais
  totalCorrect: number
  totalAttempts: number
}
```

Regra comum de progressão: 3 acertos seguidos sobe 1 nível (streak zera), 1 erro
desce 1 nível (streak zera), nível mínimo 1, máximo 5.

## Áudio de referência (`audioEffects.ts`)

Loop curto sintetizado via `pluckNote` (reaproveita `audio/pluck.ts`), tocando
uma tríade simples em loop (2-3s). Cada jogo de efeito (eq/pan/delay/compressão)
usa o mesmo loop como fonte seca ("A") e aplica o nó de efeito Web Audio
correspondente pra gerar a versão molhada ("B"):

- EQ: `BiquadFilterNode` tipo `peaking`
- Pan: `StereoPannerNode`
- Delay: `DelayNode` + `GainNode` de feedback
- Compressão: `DynamicsCompressorNode`

Cada `games/*.ts` só decide os parâmetros do nó (frequência/gain, posição,
tempo, ratio/threshold) conforme o nível, e devolve o `Round`.

## Mecânica por jogo

**EQ** — filtro peaking, frequência aleatória (20Hz–20kHz), ganho fixo por
nível (nível 1: ±12dB, decrescendo a ±6dB, ±3dB nos níveis seguintes).
Resposta: slider log de frequência. Tolerância: nível 1 = ±1 oitava,
apertando a cada nível até ±0.25 oitava no nível 5.

**Pan** — `StereoPannerNode`, valor aleatório -1..1. Resposta: slider linear
-1..1. Tolerância: nível 1 = ±0.4, apertando até ±0.1 no nível 5.

**Delay** — tempo sorteado de um conjunto de opções (múltipla escolha):
nível 1 = 3 opções bem espaçadas (80ms/250ms/500ms); nível 3+ = 5 opções mais
próximas (80/150/250/350/500ms) e mix mais sutil (menor feedback/wet).

**Compressão** — ratio/threshold sorteado de um conjunto (múltipla escolha):
nível 1 = 3 níveis (leve/médio/pesado); nível 3+ = 5 níveis com diferenças
menores entre si.

**Acordes** — `pluckNote` toca tríade/tétrade com qualidade sorteada entre as
8 desde o nível 1 (maior, menor, dim, aum, maj7, 7, m7b5, dim7 — via
`theory/chord.ts`). Múltipla escolha com `min(4 + nível, 8)` opções.

## Tela de jogo (`ExercisePlay.tsx`)

Genérica, parametrizada por `ExerciseDef` + nível atual (de `progress.ts`):

- Cabeçalho: nível atual, streak atual
- Botões "Tocar A" / "Tocar B" (reproduzem `round.playDry`/`round.playWet`)
- Corpo: grade de botões (modo `choice`) ou slider + botão "Confirmar" (modo
  `slider`)
- Ao responder: marca acerto/erro (choice: `id === correctChoiceId`; slider:
  `Math.abs(valor - correctValue) <= tolerance`), atualiza `progress.ts`,
  mostra feedback (slider revela valor certo vs. escolhido) e botão "Próxima"
  que gera nova `Round` pro nível atualizado.

## Estilo visual

Segue `identidade-visual-apps` e padrões existentes de `styles.css`
(`.btn`, `.chip`, `.panel-section`, `.sheet`) — sem paleta/sombra nova.
Ícones Heroicons (`/24/outline`, `/24/solid` no card ativo se aplicável).

## Testes (2-3 essenciais, escritos antes da implementação)

1. `progress.ts`: 3 acertos seguidos sobe nível e zera streak; 1 erro desce
   nível (não abaixo de 1) e zera streak.
2. Jogo de slider (ex. `games/eq.ts` + lógica de acerto): valor dentro da
   tolerância do nível conta como acerto; fora, como erro.
3. Jogo de múltipla escolha (ex. `games/chords.ts`): `generateRound` sempre
   inclui a opção correta entre as `choices` geradas, sem duplicatas.

## Fora de escopo (v1)

- Áudio real gravado/embutido (loop é sempre sintetizado).
- Persistência em backend/nuvem (só localStorage local).
- Outros jogos do SoundGym (altura absoluta, ganho, saturação, etc.).
