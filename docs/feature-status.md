# Estado de funcionalidades

Quando ler: antes de criar, remover ou recriar funcionalidade.
Fonte de verdade para: o que foi removido e não deve voltar; contratos visíveis.
Atualizado em: 14/10/2026.

## Não reimplementar

Funcionalidade removida ou substituída, com data e o que cobre o uso agora.

- `lucide-react`: substituído por Heroicons em 05/09/2026; pacote desinstalado em 08/09/2026.
- Rótulo de texto embaixo dos ícones da barra de abas: removido (nome em `aria-label`/`title`).
- Ajuste fino de bpm (−5/−1/+1/+5 e "usar N bpm") no painel Ritmo: saiu; o rodapé da música tem −1/+1 e a batida traz o andamento sugerido.
- Trio de números de prática no Início: substituído pelo `PracticeCard` (meta semanal).
- VoiceLab no painel Acordes da música: movido para a aba Afinação (toggle Afinação/Voz).
- Loop sintético como som principal dos exercícios de mixagem: substituído por trechos de música real (fica só como reserva se o arquivo falhar).

## Contratos visuais e funcionais

Comportamentos visíveis que parecem estranhos mas são intencionais.
