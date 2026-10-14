# Interface, estilo e navegação

Quando ler: ao criar ou mexer em tela, componente, ícone, CSS, abas, Configurações, listas, busca ou arquivos gerados.
Fonte de verdade para: padrões visuais e de interação já existentes no app.
Atualizado em: 14/10/2026 (movido do `CLAUDE.md`).

## Particularidade técnica de ícones

Heroicons não trazem largura/altura intrínsecas — o tamanho vem sempre do CSS
(`.icon svg`, `.tabbar-item svg` em `styles.css`, ou `[&>svg]:w-…` na classe do
botão). Ícone novo sem regra de tamanho renderiza gigante.

## Migração Tailwind + Lucide (concluída, 2026-08-30)

O app usava CSS por classe (`src/styles.css`, 814 linhas) e `@heroicons/react`.
Migrado para Tailwind v4 (`@tailwindcss/vite`) e `lucide-react` em 10 rodadas
incrementais (3 telas por rodada, decisão do usuário), com build/typecheck/teste
e verificação visual no browser a cada rodada, commit+push por rodada. Paleta
atual (`--bg`, `--fg`, `--accent` etc.) foi mantida (sem unificar com outro
design system) e mapeada em `src/styles.css` via bloco `@theme inline` —
continua funcionando com os dois temas (claro/escuro) exatamente como antes,
só que como tokens Tailwind (`bg-bg2`, `text-fg`, `border-line`...).

`styles.css` caiu de 814 para ~350 linhas: o que sobrou é CSS genuinamente
compartilhado entre várias telas (`.btn`, `.icon`, `.hint`, `.chip`, `.sheet*`,
`.field`, `.toggle`, `.panel`, resets globais, `@font-face`) ou efeitos que
Tailwind não expressa bem em utility (gradiente de sombra de scroll da
`.toolbar`). Todo esse CSS customizado vive dentro de `@layer components` —
**isso é obrigatório**: sem `@layer`, CSS solto sempre vence qualquer utility
Tailwind por causa de cascade layers, não importa a especificidade, e overrides
tipo `flex-nowrap` em cima de uma classe antiga simplesmente não fazem efeito
nenhum, silenciosamente. Foi um bug real descoberto e corrigido no meio da
migração (rodada 8) — qualquer CSS novo adicionado a este arquivo deve ficar
dentro do bloco `@layer components { ... }` existente.

Ao adicionar uma tela/componente novo agora: usar utilities Tailwind direto,
reaproveitando as classes de `styles.css` (`.btn`, `.icon`, `.chip`, `.sheet`,
`.panel-section` etc.) para os padrões de design system em vez de duplicá-los
com utilities soltas.

## Cards com ações escondidas (swipe)

`SongCard` (usado em Início e Listas) esconde duplicar/apagar atrás do card,
revelados arrastando horizontalmente (pointer events com captura só após um
deslocamento mínimo — capturar o ponteiro no `pointerdown` cru quebra o clique
de botões internos, foi tentado e falhou) ou pelo botão "⋮" (alternativa sem
gesto, exigida pelas diretrizes de acessibilidade: toda ação por gesto precisa
de equivalente por toque/teclado). Painel de ações fica com `aria-hidden` e
`tabIndex={-1}` quando fechado. Reaproveitar esse padrão para qualquer lista
de cards que precise do mesmo tipo de ação secundária.

## Barra de abas sem rótulo

`TabBar` mostra só o ícone (nome fica em `aria-label`/`title`) e troca o ícone
vazado pelo preenchido na aba ativa. São cinco abas fixas nas mesmas posições;
o texto de 10px embaixo do ícone só apertava a barra.

Visual vítreo (12/09/2026, pedido do usuário): a barra flutua sobre o conteúdo
(`position: absolute` dentro de `.app-shell`, `backdrop-filter: blur`), com as
quatro abas de conteúdo numa pílula e Configurações num círculo à parte. Aba
ativa ganha fundo translúcido de destaque. `.app-content` tem folga embaixo e
os botões flutuantes (importar, gravador) ficam em `bottom: 5.6rem` para não
cair em cima dela. É uma exceção deliberada à regra "sem sombra".

## Configurações

Cabeçalho grande com linha embaixo, tema como controle segmentado de largura
total (`.segmented`, opções escritas), busca que filtra seções por título e
palavras-chave, e cada seção num card recolhível (`.fold`, `<details>`) que
abre sozinho quando a busca casa. Seção nova entra no array `sections` de
`SettingsTab.tsx` com `keywords` preenchidas.

## Ícone do app

Fundo branco (`public/icon.svg` e `ic_launcher_background` = `#FFFFFF`), com
traços escuros. Os PNGs de `android/app/src/main/res/mipmap-*` são gerados do
SVG com `rsvg-convert` (foreground sem fundo, 108dp; legado quadrado e redondo).

## Barra de transporte da tela da música

Os botões redondos do rodapé e as barras fixas vivem em `src/components/song/parts.tsx`
(`TransportButton` com tamanhos `sm`/`md`/`lg`, `BottomBar`, `StripBar`). Antes cada
botão repetia as mesmas ~10 utilities Tailwind com todas as variantes `max-[620px]:`
dentro de `SongView.tsx`, e um ajuste de tamanho tinha de ser refeito em cinco cópias.
Qualquer botão novo do rodapé usa esses componentes.

## Arquivos que o app gera

Tudo o que o app grava (cifra em .txt, gravações, backup manual e o automático
semanal) passa por `native/fileStorage.ts#saveAppFile`, que escreve em
`Documentos/CifrasGroup/<subpasta>` no app nativo e cai no download comum no
navegador. Não usar `<a download>` direto: no WebView do Android o arquivo não
fica em lugar nenhum que o usuário ache depois.

## Preferências de tela lembradas

Filtros e ordenação da biblioteca ficam em `store/libraryPrefs.ts` (localStorage,
lido campo a campo para um valor estranho não quebrar a tela). A busca por texto
fica de fora de propósito. Telas são desmontadas ao trocar de aba, então estado
de filtro que o usuário escolheu precisa morar fora do componente.

## Busca da biblioteca

`store/songSearch.ts#songMatchesQuery` compara o termo com título, artista, tags
**e o texto da cifra**, tudo normalizado sem acento e sem caixa. Quem não lembra
o nome procura por um trecho da letra — antes isso não achava nada. Qualquer
lista nova que filtre músicas por texto usa essa função, não um `includes` local.

## Ajuda recolhida (ⓘ) e tokens de estado

`components/Ajuda.tsx` é o balão de explicação do padrão compartilhado (portal,
preso a 12px da tela, fecha com toque fora/Esc/rolagem). Texto de "como usar"
não fica mais impresso embaixo de controles — vai para um `Ajuda` ao lado do
título/rótulo. Mensagens de estado (erro de microfone, "ouvindo…") continuam
visíveis. Cores de estado: `--ok` (verde: meta batida, sequência, acerto),
`--warn` (aviso), `--danger`, `--blue` só para foco de campo. `--line` ficou
mais suave e botões/chips sobre `bg3` não têm borda.

## Ordem das listas

Arrastar pela alça ≡ do card reordena (`useDragReorder` em `ListsView.tsx`,
ouvintes na janela porque a troca move o card no DOM e derruba a captura do
ponteiro). Tocar na alça sem arrastar mostra ↑/↓; teclado usa as setas na alça.
