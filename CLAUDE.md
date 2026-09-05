# Instruções para o Claude neste projeto

## Commit, push e APK automáticos

Sempre que uma mudança de código for implementada neste app (uma feature, correção
de bug, ajuste de UI, etc.) e o trabalho estiver validado (typecheck, testes e
`npm run check` passando), faça automaticamente, sem precisar que o usuário peça
de novo a cada vez:

1. `git add` dos arquivos alterados relevantes, `git commit` com mensagem descritiva
   (em português, explicando o "porquê") e `git push origin main`.
2. Gerar o APK de debug atualizado:
   ```bash
   npm run build
   npx cap sync android
   export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
   cd android && ./gradlew assembleDebug --console=plain
   ```
   O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`. Envie-o ao
   usuário (SendUserFile) ao final.

Notas:
- O projeto exige JDK 21 para compilar o módulo Android (`capacitor.build.gradle`
  define `sourceCompatibility`/`targetCompatibility` como `VERSION_21`), mas o
  `java_home` do sistema pode apontar para o JDK 17. Use o `openjdk@21` do
  Homebrew via `JAVA_HOME` explícito no comando do Gradle, como acima.
- É um build de **debug**, assinado com a chave de debug padrão — serve para
  testar no aparelho, não para publicar na Play Store. Não existe keystore de
  release configurado; se um dia for necessário gerar build de release, isso
  exige um keystore próprio do usuário (não gerar isso sozinho sem o usuário
  participar, já que é uma chave sensível que precisa ficar guardada por ele).
- Só pule o passo de commit/push se o usuário pedir explicitamente para não
  commitar, ou se as mudanças ainda estiverem incompletas/quebradas.
- Sempre revise `git status`/`git diff` antes de commitar para não incluir
  arquivos indesejados (ex.: artefatos de build, `.env`, etc.).

## Cuidado com UX/UI ao implementar telas novas

Feedback direto do usuário (29/08/2026): uma leva de mudanças de UI (reorganização
da tela de música, gravador flutuante, abas novas) saiu com cores/formas fora do
padrão visual do resto do app e sem cuidado básico com funções de microfone. Antes
de desenhar uma tela nova ou componente novo:

- **Acione a skill `identidade-visual-apps`** antes de estilizar qualquer tela ou
  componente novo (e ao revisar algo que "não bate com o resto do app"). Não
  invente linguagem visual nova (sombras, formas, paleta) sem antes checar essa
  skill e os padrões já existentes em `src/styles.css` — reaproveite classes e
  variáveis (`--bg2`, `--bg3`, `--line`, `--accent`, `--accent2`, `.icon`, `.btn`,
  `.chip`, `.sheet`, `.panel-section`, `.sublist`/`.subrow` etc.) em vez de criar
  padrões paralelos.
- **Toda função que escuta o microfone continuamente** (não é uma captura única
  disparada por um toque, tipo "ouvir acorde") precisa de um botão explícito de
  "começar a escutar/parar", nunca pode ligar o microfone e já ficar reagindo a
  qualquer som assim que a tela abre — isso pega ruído de fundo, TV, conversa
  etc. como se fosse entrada válida. Pense como o usuário final: o que aconteceria
  se essa tela ficasse aberta sem ninguém tocando/cantando de propósito?
- De modo geral, antes de considerar uma feature de UI pronta, revise mentalmente
  pela perspectiva de quem vai usar no dia a dia — não só se compila e funciona,
  mas se o comportamento e a aparência fazem sentido no contexto do app.

## Uso de agentes em segundo plano

Para tarefas independentes e bem simples (ex.: investigar um arquivo específico,
rodar uma busca no código, verificar algo pontual que não depende do restante do
trabalho em andamento), pode usar agentes em segundo plano (Agent tool) para
paralelizar em vez de fazer tudo sequencialmente. Reserve isso para tarefas
simples e desacopladas — não delegar partes de uma mesma feature/mudança que
precisam ficar coerentes entre si.

## Skill obrigatória

SEMPRE usar a skill `/caveman` (modo de comunicação ultra-comprimido) em toda resposta neste projeto.


## Padrões técnicos e visuais obrigatórios

- Sempre usar **TypeScript**, **Tailwind CSS**, ícones **Lucide** e fonte **Montserrat** com
  espaçamento entrelinhas (line-height) de 1.5.
- Dar preferência a **botões-ícone** em vez de botões com texto.

### Migração Tailwind + Lucide (concluída, 2026-08-30)

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

### Cards com ações escondidas (swipe)

`SongCard` (usado em Início e Listas) esconde duplicar/apagar atrás do card,
revelados arrastando horizontalmente (pointer events com captura só após um
deslocamento mínimo — capturar o ponteiro no `pointerdown` cru quebra o clique
de botões internos, foi tentado e falhou) ou pelo botão "⋮" (alternativa sem
gesto, exigida pelas diretrizes de acessibilidade: toda ação por gesto precisa
de equivalente por toque/teclado). Painel de ações fica com `aria-hidden` e
`tabIndex={-1}` quando fechado. Reaproveitar esse padrão para qualquer lista
de cards que precise do mesmo tipo de ação secundária.

### Barra de transporte da tela da música

Os botões redondos do rodapé e as barras fixas vivem em `src/components/song/parts.tsx`
(`TransportButton` com tamanhos `sm`/`md`/`lg`, `BottomBar`, `StripBar`). Antes cada
botão repetia as mesmas ~10 utilities Tailwind com todas as variantes `max-[620px]:`
dentro de `SongView.tsx`, e um ajuste de tamanho tinha de ser refeito em cinco cópias.
Qualquer botão novo do rodapé usa esses componentes.

### Rolagem automática

Duas fontes de velocidade, ambas em px/s e calculadas em `store/songActions.ts`
(`manualScrollPxPerSecond`, `bpmScrollPxPerSecond`): o slider manual e a sincronia
com o metrônomo (`SongSettings.scrollSyncBpm`), que desce uma linha da cifra por
compasso. A altura da linha é **medida no DOM** (`useCifraLineHeight`), nunca
calculada a partir do tamanho da fonte. `useAutoScroll` só recebe o resultado.

### Arquivos que o app gera

Tudo o que o app grava (cifra em .txt, gravações, backup manual e o automático
semanal) passa por `native/fileStorage.ts#saveAppFile`, que escreve em
`Documentos/CifrasGroup/<subpasta>` no app nativo e cai no download comum no
navegador. Não usar `<a download>` direto: no WebView do Android o arquivo não
fica em lugar nenhum que o usuário ache depois.

### Preferências de tela lembradas

Filtros e ordenação da biblioteca ficam em `store/libraryPrefs.ts` (localStorage,
lido campo a campo para um valor estranho não quebrar a tela). A busca por texto
fica de fora de propósito. Telas são desmontadas ao trocar de aba, então estado
de filtro que o usuário escolheu precisa morar fora do componente.

### Aba "Voz" mora em Afinação, não em Acordes

VoiceLab (retrato de timbre por microfone) foi movido do painel Acordes da
tela da música para dentro da aba raiz Afinação (toggle Afinação/Voz), porque
não é uma função de acorde — ficava enterrada no 3º nível de navegação sem
necessidade.

## Testes

- Por rodada de alterações, realizar apenas os **2 ou 3 testes mais essenciais** — não mais que isso.
- Esses testes devem ser **elaborados ANTES** da implementação das mudanças de código, para que não
  sejam enviesados pelo resultado da implementação.


## Commit, push e atualização do CLAUDE.md

- A cada rodada em que o código do app/site for alterado, deve ser feito o **commit** e o **push**
  para o repositório remoto no GitHub.
- Nessa mesma rodada, atualizar o conteúdo deste **CLAUDE.md** no que couber (novas convenções,
  decisões, mudanças de stack, etc.), mantendo-o coerente com o estado atual do projeto.

## Proibição de leitura de dependências

- NUNCA ler arquivos de dependências (ex.: `node_modules/`, `dist/`, `build/`, pastas de vendor
  ou qualquer artefato gerado/instalado) para obter contexto. Usar apenas o código-fonte do
  próprio projeto.

