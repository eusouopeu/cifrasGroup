# Tela da música, áudio, exercícios e prática

Quando ler: ao mexer em ritmo/metrônomo, rolagem, afinador, voz, exercícios de ouvido, seções da cifra, gravações ou metas de prática.
Fonte de verdade para: comportamento do áudio, dos exercícios e das contas de prática.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

## Painel Ritmo compacto

O bloco do metrônomo é uma linha só: tocar/parar, bpm, ícone de alto-falante
(no lugar do rótulo "Tocar") e os chips batida/metrônomo.

## O que sai no alto-falante (painel Ritmo)

Batida (`playPattern`) e clique do metrônomo (`playClick`) são independentes no
motor (`audio/metronome.ts`) desde sempre, mas viviam em dois ícones sem rótulo
e ninguém descobria que dava para tocar **só a batida**. Agora são dois chips
rotulados ("Tocar: batida / metrônomo"), com aviso quando os dois estão
desligados. O ajuste fino de bpm (−5/−1/+1/+5 e "usar N bpm") saiu do painel:
o rodapé da tela da música já tem −1/+1 e escolher uma batida traz o andamento
sugerido dela.

## Rolagem automática

Duas fontes de velocidade, ambas em px/s e calculadas em `store/songActions.ts`
(`manualScrollPxPerSecond`, `bpmScrollPxPerSecond`): o slider manual e a sincronia
com o metrônomo (`SongSettings.scrollSyncBpm`), que desce uma linha da cifra por
compasso. A altura da linha é **medida no DOM** (`useCifraLineHeight`), nunca
calculada a partir do tamanho da fonte. `useAutoScroll` só recebe o resultado.

## Resumo de prática aparece em duas telas

`store/practiceSummary.ts` (`practiceSummary` + `formatPracticeTotal`) é a conta
única usada por Início e por Configurações. Início mostra o trio de números logo
abaixo da busca, que é onde o usuário passa todo dia; Configurações mantém a
versão em prosa. Não duplicar a conta numa terceira tela — importar daqui.

## Afinador só escuta quando mandam

`Tuner` abre com o microfone **desligado** (`listenOn`, botão "começar a
escutar" / "parar de escutar"), nas duas formas de uso (aba Afinação e folha
aberta pela música). Com a escuta sempre ligada, o ponteiro reagia a TV, conversa
e ruído ambiente sem ninguém ter tocado uma corda — é a regra geral de microfone
contínuo deste CLAUDE.md aplicada aqui.

## Cards dos exercícios

Cada `ExerciseDef` tem `description`: uma linha dizendo o que o ouvido treina.
A lista (`exercises/ExercisesTab.tsx`) mostra ícone, título, essa descrição,
nível em pontinhos (`MAX_LEVEL` vem de `exercises/progress.ts`) e % de acerto.
Antes eram cinco botões idênticos que só diferiam no número do nível — não dava
para saber o que cada um cobrava nem por onde começar. Exercício novo entra com
`description` preenchida.

Desde 01/10/2026 a `description` fica atrás do ⓘ (`Ajuda`) no card, não
impressa: o card mostra ícone, título, pontinhos de nível e % de acerto. Ordem
da lista: ouvido musical (intervalos, acordes, campo harmônico, ditado rítmico)
e depois mixagem (EQ, pan, delay, compressão).

## Exercícios de EQ/pan/delay/compressão usam música real

O loop sintético (tríade em pluck) soava artificial demais para treinar
ouvido. Agora os quatro jogos tocam trechos de 20 s de faixas de Kevin MacLeod
(incompetech.com, **CC BY 4.0** — exige crédito, mostrado no rodapé da rodada),
catalogados em `exercises/samples.ts` e guardados em `public/exercise-samples/`
(AAC 128 kbps, ~330 KB cada). `audioEffects.ts#playSample` normaliza volume
por RMS, corta o que estava tocando antes (A e B nunca se sobrepõem), aceita
cadeia de efeito `{ input, output }` e cai no loop sintético se o arquivo
falhar. Pan soma a música em mono antes do panner; delay soma seco + eco;
compressão tem ganho de compensação para não ser julgada só pelo volume.
Trecho novo: só com licença que permita uso em app (CC0/CC BY) e com crédito.

## Aba "Voz" mora em Afinação, não em Acordes

VoiceLab (retrato de timbre por microfone) foi movido do painel Acordes da
tela da música para dentro da aba raiz Afinação (toggle Afinação/Voz), porque
não é uma função de acorde — ficava enterrada no 3º nível de navegação sem
necessidade.

## Seções da cifra

`cifra/sections.ts` lista as seções ([Intro], [Refrão]…; repetidas ganham
número). Na tela da música viram chips (`SectionChips` em `song/parts.tsx`):
tocar pula, segurar liga o loop da seção. O botão de loop da barra de rolagem,
sem texto selecionado, repete a seção que está no topo da tela (equivalente
sem gesto).

## Meta semanal e "para praticar"

`DB.practiceDays` (ms por dia local) e `DB.weeklyGoalMin` alimentam
`store/practiceGoals.ts` (semana de segunda a hoje, sequência de dias,
`songsToPractice`). O cartão do Início (`PracticeCard`) substituiu o trio de
números; a meta se escolhe tocando nele ou em Configurações → Prática.

## Comparar gravações

Na aba Gravações, com 2+ tomadas do mesmo tipo, o ícone de balança abre
`RecordingCompare`: A (mais antiga) × B (mais recente) por padrão, um player
com chave A|B que mantém o ponto ao trocar.
