# Estado de funcionalidades

Quando ler: antes de criar, remover ou recriar funcionalidade.
Fonte de verdade para: o que foi removido e não deve voltar; contratos visíveis.
Atualizado em: 07/11/2026.

## Não reimplementar

Funcionalidade removida ou substituída, com data e o que cobre o uso agora.

- Contagem visual de 4 tempos antes do metrônomo (`useCountIn`) – removida em 29/08/2026.
- Botão de baixar a cifra em .txt – removido em 31/08/2026; a gravação automática em Documentos/CifrasGroup cobre o uso.
- Botões separados de gravar áudio e vídeo – unidos em 31/08/2026; o modo se escolhe no gravador flutuante.
- Acordes nos cards do Início – removidos em 31/08/2026; ficam só em Listas.

- `lucide-react`: substituído por Heroicons em 05/09/2026; pacote desinstalado em 08/09/2026.
- Rótulo de texto embaixo dos ícones da barra de abas: removido (nome em `aria-label`/`title`).
- Ajuste fino de bpm (−5/−1/+1/+5 e "usar N bpm") no painel Ritmo: saiu; o rodapé da música tem −1/+1 e a batida traz o andamento sugerido.
- Trio de números de prática no Início: substituído pelo `PracticeCard` (meta semanal).
- VoiceLab no painel Acordes da música: movido para a aba Afinação (toggle Afinação/Voz).
- Loop sintético como som principal dos exercícios de mixagem: substituído por trechos de música real (fica só como reserva se o arquivo falhar).

## Contratos visuais e funcionais

Comportamentos visíveis que parecem estranhos mas são intencionais.

- A barra da batida só aparece com o metrônomo tocando.
- Com ordem diferente de "Repertório", a lista não mostra a alça de reordenar.
- Rolagem inteligente ligada pausa a rolagem por velocidade.
- Desfazer da edição da cifra tem um nível só; o botão some depois de usado.
- Títulos e abas dos painéis de Tom e Simplificação ficam embaixo, para não pularem quando o conteúdo muda de altura.
