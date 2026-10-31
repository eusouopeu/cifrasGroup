# Decisões

Quando ler: antes de mudar comportamento já decidido.
Fonte de verdade para: o que já foi decidido no projeto (uma linha por decisão).
Atualizado em: 31/10/2026.

Decisão nova entra no topo, com data e onde está detalhada. Decisão ainda em
aberto fica em [pendencias.md](pendencias.md).

| Data | Decisão | Detalhe em |
|---|---|---|
| 31/10/2026 | CI no GitHub roda tipos e testes em cada push e PR | `.github/workflows/ci.yml` |
| 14/10/2026 | Ícones sempre em Heroicons; nunca `lucide-react` | `CLAUDE.md`, `docs/interface.md` |
| 14/10/2026 | Documentação segue `../_shared/docs-standards.md` | `CLAUDE.md` |
| 01/10/2026 | Instruções fixas viram o componente Ajuda (ⓘ em balão), seguindo `design-standards.md` e `minimalismo.md` | `docs/interface.md` |
| 01/10/2026 | Banco guarda o tempo praticado por dia (`practiceDays`) e a meta semanal (`weeklyGoalMin`) | `docs/musica-e-pratica.md` |
| 12/09/2026 | Exercícios de mixagem usam trechos de música real; o loop sintético fica só de reserva | `docs/musica-e-pratica.md` |
| 05/09/2026 | Barra de abas só com ícones (nome em `aria-label`/`title`) | `docs/interface.md` |
| 31/08/2026 | Cifras e gravações são salvas em Documentos/CifrasGroup (o download por blob não funciona no WebView); no navegador, download comum | `docs/interface.md` |
| 31/08/2026 | Apagar música só apaga as gravações depois que a janela de desfazer expira | `docs/interface.md` |
| 31/08/2026 | Música de exemplo apagada de propósito não volta (flag persistida) | `docs/interface.md` |
| 31/08/2026 | Paletas de emoção sempre partem dos acordes originais, sem compor transformação sobre transformação | `docs/musica-e-pratica.md` |
| 31/08/2026 | Backup automático semanal só no app nativo, mantendo os 3 mais recentes | `docs/interface.md` |
| 29/08/2026 | Metrônomo toca ao tocar no play, sem contagem antes | `docs/musica-e-pratica.md` |
| 29/08/2026 | Estilos migrados para Tailwind v4 | `docs/interface.md` |
| 13/08/2026 | Biblioteca guardada em IndexedDB | `docs/musica-e-pratica.md` |
