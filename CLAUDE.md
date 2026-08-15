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
