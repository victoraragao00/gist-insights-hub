# PENDENTES — Violações em Aberto

> Atualizado automaticamente pelo Cowork após cada auditoria.
> Última atualização: 2026-03-08

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| A1 | 2026-03-08 | ATENÇÃO | SearchPage.tsx:60 | useEffect referencia `clientSearchError` antes da declaração (TDZ) | ABERTO |
| A2 | 2026-03-08 | ATENÇÃO | Audits.tsx:626 | `key={i}` em lista dinâmica de recipients — viola .cursor/rules #10 | ABERTO |
| A3 | 2026-03-08 | ATENÇÃO | CONTEXT.md:121 | Issue #13 marcada "Aberto" na tabela mas "Fechado (won't-fix)" nos Próximos Passos | ABERTO |
| O1 | 2026-03-08 | OBSERVAÇÃO | useAuditRules.ts:16 | `alert_recipients: unknown` — poderia ser tipado como Array | ABERTO |
| O2 | 2026-03-08 | OBSERVAÇÃO | SearchPage/ClientDetailPage/Index | TONE_CONFIG duplicado em 3 páginas (DRY) | ABERTO |
| O3 | 2026-03-08 | OBSERVAÇÃO | useAuditRules.ts:32 | queryKey não inclui `limit` (impacto zero hoje) | ABERTO |
| O4 | 2026-03-08 | OBSERVAÇÃO | CONTEXT.md:338 | Agente "Projeto" ainda listado na Colaboração junto com Cowork — esclarecer se coexistem ou se Projeto foi absorvido | ABERTO |
| O5 | 2026-03-08 | OBSERVAÇÃO | CONTEXT.md:330 | AGENTS.md v9 referenciado mas sem changelog v8→v9 | ABERTO |
