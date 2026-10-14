# cifrasGroup — instruções permanentes

Leitor de cifras para violão com análise harmônica, metrônomo, afinador,
gravações e exercícios de ouvido. Sem servidor e sem conta (IndexedDB).
React + TypeScript + Tailwind v4, Capacitor (Android).

Leia somente os documentos pertinentes à tarefa; não carregue documentação ou
arquivos grandes por padrão.

## Padrões compartilhados

Segue `../_shared/tech-standards.md` (stack, testes, commit/push/release,
`/caveman`, subagentes, dependências), `../_shared/design-standards.md`,
`../_shared/minimalismo.md` e `../_shared/docs-standards.md`.
Exceções e particularidades:

- Ícones: **sempre Heroicons** (`@heroicons/react`), em todo ícone novo ou
  tocado. Nunca `lucide-react` nem outra biblioteca (saiu em 05/09/2026,
  pacote desinstalado em 08/09/2026).
- Barra de abas vítrea é exceção deliberada à regra "sem sombra" (pedido do
  Pedro, 12/09/2026).

## Regras invioláveis

- **Antes de estilizar tela ou componente novo**, acione a skill
  `identidade-visual-apps` e reaproveite classes e variáveis de
  `src/styles.css` (`--bg2`, `--bg3`, `--line`, `--accent`, `.icon`, `.btn`,
  `.chip`, `.sheet`, `.panel-section`…); não invente sombras, formas ou paleta
  (feedback do Pedro, 29/08/2026).
- **Microfone contínuo** só liga por botão explícito "começar/parar de
  escutar"; nunca ao abrir a tela. Captura única disparada por toque (ex.:
  "ouvir acorde") não precisa.
- Antes de dar uma feature de UI por pronta, revise pela perspectiva de quem
  usa no dia a dia, não só se compila.
- CSS novo em `src/styles.css` fica **dentro** do bloco
  `@layer components { ... }`; fora dele, vence qualquer utility Tailwind em
  silêncio.
- Heroicons não têm tamanho intrínseco: todo ícone novo precisa de regra de
  tamanho (`.icon svg`, `[&>svg]:w-…`), senão renderiza gigante.
- Toda ação por gesto tem equivalente por toque/teclado (ex.: "⋮" no
  `SongCard`, ↑/↓ na alça das listas).
- Arquivo gerado pelo app passa por `native/fileStorage.ts#saveAppFile`;
  nunca `<a download>` direto (no WebView o arquivo some).
- Fontes únicas: busca de música por texto usa
  `store/songSearch.ts#songMatchesQuery`; resumo de prática usa
  `store/practiceSummary.ts`; velocidade de rolagem vem de
  `store/songActions.ts`, com altura de linha **medida no DOM**.
- Botão novo do rodapé da tela da música usa `TransportButton`/`BottomBar`/
  `StripBar` (`src/components/song/parts.tsx`).
- Seção nova de Configurações entra em `sections` de `SettingsTab.tsx` com
  `keywords`; exercício novo entra com `description` (exibida atrás do ⓘ).
- Trecho de áudio novo para exercícios: só licença que permita uso em app
  (CC0/CC BY) e com crédito.

## Segurança e dados

- Build é de **debug**, com a chave de debug. Não existe keystore de release;
  se um dia for preciso, o Pedro participa e guarda a chave — não gerar
  sozinho.
- Revise `git status`/`git diff` antes de commitar (sem artefatos de build ou
  `.env`).

## Fluxo de trabalho

- Faça a menor alteração completa; não faça refactor não relacionado.
- Antes de propor melhorias ou recriar algo, consulte
  `docs/feature-status.md` ("Não reimplementar") e `docs/aprimoramentos.md`
  ("Recomendações refutadas").
- Validação antes do commit: typecheck, testes e `npm run check`.
- Build do APK (o restante segue o fluxo global):
  ```bash
  npm run build
  npx cap sync android
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  cd android && ./gradlew assembleDebug --console=plain
  ```
  Saída: `android/app/build/outputs/apk/debug/app-debug.apk`. Push para
  `origin main`.

## Fim de sessão

Antes do commit, atualizar: `docs/decisoes.md` (decisão nova no topo),
`docs/pendencias.md`, `docs/feature-status.md` se uma funcionalidade visível
mudou, `docs/aprimoramentos.md` se uma melhoria foi entregue ou recusada e o
documento temático tocado (`interface`, `musica-e-pratica`).

## Atualização desta documentação

- `CLAUDE.md` só muda quando uma regra global do projeto muda.
- Detalhe de tela, componente ou funcionalidade vai para o `docs/<tema>.md`.

## Navegação

| Arquivo | Quando ler |
|---|---|
| `docs/interface.md` | Ícones, CSS/Tailwind, abas, cards, Configurações, busca, listas, arquivos gerados, ⓘ e tokens de estado |
| `docs/musica-e-pratica.md` | Ritmo e metrônomo, rolagem, afinador, voz, exercícios, seções da cifra, gravações, metas de prática |
| `docs/superpowers/specs/`, `plans/` | Desenho e plano de features grandes |
| `docs/decisoes.md` | Antes de mudar comportamento já decidido |
| `docs/pendencias.md` | Ao retomar o projeto ou propor próximos passos |
| `docs/feature-status.md` | Antes de criar ou remover funcionalidade |
| `docs/aprimoramentos.md` | Antes de sugerir melhorias |
