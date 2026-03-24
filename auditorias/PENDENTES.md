# PENDENTES — Violações em Aberto

> Atualizado por: Claude Code (Auditoria Completa 2026-03-22)
> Última atualização: 2026-03-22

## Críticas

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| SEC1 | 2026-03-22 | CRÍTICO | gist-discover/index.ts:46 | Sem validação JWT + CORS aberto — endpoint exposto com service_role | ABERTO |
| SEC2 | 2026-03-22 | CRÍTICO | gist-proxy/index.ts:1,32 | Sem validação JWT + CORS aberto + params sem sanitização | ABERTO |
| AP1 | 2026-03-22 | CRÍTICO | process-jobs/index.ts:380 | DELETE sem filtro `auto_created` — risco de apagar dados reais | ABERTO |

## Altas

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| AP2 | 2026-03-22 | ALTO | evaluate-audit-rules/index.ts:166 | INSERT audit_alerts sem ON CONFLICT — falha em duplicata | ABERTO |
| AP3 | 2026-03-22 | ALTO | gist-confirm-mapping/index.ts:77+ | Múltiplos INSERTs sem conflict handling — duplicatas em re-execução | ABERTO |
| M12 | 2026-03-22 | ALTO | InteractionsFeed.tsx:463-477 | Query sem .range()/.limit() — pode retornar milhares de linhas | ABERTO |

## Médias

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| M1a | 2026-03-22 | MÉDIO | 4 hooks + 2 componentes | 7x `as unknown as Type` — bypass de tipagem (m1) | ABERTO |
| M9a | 2026-03-22 | MÉDIO | GistContactWizard.tsx:304-354 | useState manual para escrita em vez de useMutation (m9) | ABERTO |
| DS1 | 2026-03-22 | MÉDIO | DemandsDashboardPage.tsx:26-31 | HSL hardcoded em PRIORITY_COLORS | ABERTO |
| DS2 | 2026-03-22 | MÉDIO | ClientDetailPage.tsx:668-671,698 | HSL hardcoded + green-500 em vez de emerald-500 | ABERTO |
| O2 | 2026-03-08 | MÉDIO | SearchPage/ClientDetailPage/Index | TONE_CONFIG duplicado em 3 páginas (DRY) | ABERTO |

## Baixas

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| M13a | 2026-03-22 | BAIXO | — | Sem testes para process-jobs, classify-batch, ClientContext, interactions | ABERTO |
| DS4 | 2026-03-22 | BAIXO | skeleton.tsx:4 | animate-pulse em vez de animate-shimmer | ABERTO |
| DS5 | 2026-03-22 | BAIXO | Múltiplos | Zero uso de motion-safe: prefix | ABERTO |
| A2 | 2026-03-08 | BAIXO | Audits.tsx:626 | `key={i}` em lista dinâmica de recipients | ABERTO |
| O1 | 2026-03-08 | BAIXO | useAuditRules.ts:16 | `alert_recipients: unknown` — poderia ser tipado | ABERTO |

## Resolvidas (desde última auditoria)

| ID | Data | Descrição | Resolução |
|----|------|-----------|-----------|
| A1 | 2026-03-08 | SearchPage.tsx TDZ | Issue #65 — fix aplicado |
| A3 | 2026-03-08 | CONTEXT.md Issue #13 inconsistente | CONTEXT.md v21 corrigido |
| O3 | 2026-03-08 | queryKey sem `limit` | Reclassificado como sem impacto |
| O4 | 2026-03-08 | Agente "Projeto" na Colaboração | Informacional — coexistem |
| O5 | 2026-03-08 | Changelog v8→v9 ausente | Informacional |
