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
