# cifrasGroup

Leitor de cifras para violão com análise harmônica automática. Roda inteiro no
navegador, sem servidor e sem conta: as músicas e as configurações ficam no
`IndexedDB` do próprio aparelho.

**Site:** https://eusouopeu.github.io/cifrasGroup

## O que ele faz de diferente

### Simplificação automática em dois níveis

**Nível 1 — acordes.** Cada acorde da música é comparado com um catálogo de 336
candidatos por uma métrica de semelhança ponderada por função harmônica:
fundamental, terça e sétima pesam mais que quinta e tensões. Entre os que ficam
acima do limiar (80% por padrão, ajustável), vence primeiro o mais fácil de
tocar no violão e depois o mais simples na teoria.

```
G7(b9,b13)  ->  G7        88% igual
C7M(9)      ->  C7M       94% igual
Dm7(11)     ->  Dm7       94% igual
A7(#9)      ->  A7        90% igual
B           ->  sem troca (já é o mais simples; o que resolve é o nível 2)
```

Substituições que abandonam a fundamental — o clássico `G7(b9)` → `Bº` — não
entram automaticamente, mas aparecem na lista de alternativas e vêm marcadas
com "atenção: muda a nota do baixo".

**Nível 2 — tom.** Os 12 tons são ranqueados pela dificuldade média dos acordes,
ponderada pela frequência de cada um na música. O app também informa **em que
casa pôr o capotraste** para a música continuar soando no tom original enquanto
você toca as formas fáceis.

### Busca de digitações

Não há dicionário de acordes embutido: o app varre o braço inteiro e pontua cada
forma possível na ordem de prioridade de quem está aprendendo — menos cordas
mudas, sem pestana, mais cordas soltas e menos dedos, mais perto da cabeça do
braço. Os pesos foram calibrados até as posições clássicas vencerem sozinhas
(C `x32010`, G `320003`, Em `022000`, Am `x02210`).

### Paletas de emoção

Nove conjuntos (Limpo, Folk, Melancólico, Sonhador, Bossa/Jazz, Gospel/Soul,
Tenso, Rock) que reescrevem todos os acordes com um mesmo vocabulário de
extensões, preservando fundamental e modo. É o que faz o grupo combinar entre si.

### Metrônomo que toca a batida

BPM de 30 a 240, agendado pelo relógio do `AudioContext` para o pulso não
derrapar. Além do clique, ele toca os golpes da batida escolhida com timbres
distintos — descida grave e cheia, subida curta e brilhante, abafado seco,
polegar grave — e nos dedilhados cada corda soa na altura real. A coluna que
está tocando acende na grade.

### Afinador cromático

Detecção de altura por autocorrelação, com mostrador em arco: nota, desvio em
cents e a **frequência exata em Hz**. As cordas da afinação alvo são botões —
tocar num deles soa a nota certa com timbre de corda pinçada (Karplus-Strong),
para afinar de ouvido quando o ambiente está barulhento demais para o microfone.

### E ainda

- 20 batidas e dedilhados (sertanejo, samba, bossa, xote, baião, valsa, reggae,
  Travis picking, arpejos)
- Faixa de acordes da música ao tocar num acorde da letra: a digitação mais
  fácil de cada um, com rolagem horizontal; a ficha completa (digitações em
  carrossel, construção nota a nota e troca manual) sai dali
- Construção do acorde nota a nota, com alternância entre violão e piano
- Listas que guardam tom, capotraste, nível de simplificação, paleta, batida,
  velocidade de rolagem e tamanho do texto de cada música
- Tablaturas ocultas por padrão, tamanho de texto ajustável, rolagem automática
  com controle de velocidade no rodapé — ou atrelada ao metrônomo, descendo uma
  linha da cifra por compasso no andamento escolhido
- Edição do texto da cifra dentro do app, e troca manual de qualquer acorde
- Tela mantida acesa enquanto se toca (rolagem, metrônomo ou modo apresentação)
- Gravação de prática por música, com marcador para não descartar as boas
- Busca, filtros e ordenação da biblioteca lembrados entre visitas
- Backup e restauração em JSON, **com as gravações junto**, salvo na pasta do
  app em `Documentos/CifrasGroup/Backups` (e um backup automático semanal lá)

## Importar cifras

O app não raspa o CifraClub: isso violaria os termos de uso do site, e as cifras
são material de terceiros. A importação é por texto colado — o formato do
CifraClub é reconhecido automaticamente (acordes, seções, tom, capotraste e
tablaturas) — além de ChordPro e arquivos `.txt` / `.cho`. Nada sai do aparelho.

A música de exemplo que vem no app é uma grade harmônica de estudo, sem letra.

## Rodando

```bash
npm install
npm run dev
```

| comando | o que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção em `dist/` |
| `npm run check` | testes de invariante do motor teórico |
| `npm run typecheck` | checagem de tipos |

`npm run check` verifica que todo símbolo que o app é capaz de gerar volta a ser
lido pelo próprio parser com as notas certas, e que todo acorde do catálogo tem
digitação viável no violão. Esse teste já pegou quatro defeitos reais: `Dm(7M)`
ilegível, `Cdim` virando tétrade, `7sus4` não reconhecido e o baixo de acordes
com barra (`C/B`, `Am/F#`) nunca entrando no conjunto de notas tocáveis.

## Estrutura

```
src/theory/     motor harmônico — parser, semelhança, digitações, simplificação
src/cifra/      leitura do texto da cifra e montagem da versão exibida
src/audio/      metrônomo e corda pinçada em Web Audio
src/components/ interface (src/components/song/ = painéis e hooks da tela da música)
src/data/       biblioteca de batidas e dedilhados
src/hooks/      hooks gerais (wake lock)
src/store/      persistência em IndexedDB, ações de configuração e backup
```

O coração está em `src/theory/`. `voicings.ts` faz a busca no braço,
`similarity.ts` define o que significa dois acordes serem "parecidos" e
`simplify.ts` junta as duas coisas nos dois níveis.

## Licença

MIT
