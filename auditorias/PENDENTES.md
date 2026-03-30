# PENDENTES — Violações em Aberto

> Atualizado por: Claude Code
> Última atualização: 2026-03-30

## Críticas

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| SEC1 | 2026-03-22 | CRÍTICO | gist-discover/index.ts | ~~Sem validação JWT + CORS aberto~~ → JWT via auth.getUser() + CORS via ALLOWED_ORIGIN | RESOLVIDO 2026-03-24 |
| SEC2 | 2026-03-22 | CRÍTICO | gist-proxy/index.ts | ~~Sem JWT + CORS aberto + params sem sanitização~~ → JWT + CORS + safeParams | RESOLVIDO 2026-03-24 |
| AP1 | 2026-03-22 | CRÍTICO | process-jobs/index.ts:380 | ~~DELETE sem filtro auto_created~~ → .eq('metadata->>auto_created', 'true') | RESOLVIDO 2026-03-24 |

## Altas

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| AP2 | 2026-03-22 | ALTO | evaluate-audit-rules/index.ts | ~~INSERT sem ON CONFLICT~~ → error.code 23505 ignorado | RESOLVIDO 2026-03-24 |
| AP3 | 2026-03-22 | ALTO | gist-confirm-mapping/index.ts | ~~INSERTs sem conflict~~ → upsert com onConflict em 3 tabelas | RESOLVIDO 2026-03-24 |
| M12 | 2026-03-22 | ALTO | InteractionsFeed.tsx | ~~Query sem limit~~ → .limit(500) + order desc + reverse + banner | RESOLVIDO 2026-03-24 |

## Médias

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| M1a | 2026-03-22 | MÉDIO | Múltiplos hooks | ~~10x as unknown as~~ → 7 corrigidos (DT-1). 2 residuais corrigíveis + 5 justificados (JOINs/JSON/error) | PARCIAL |
| M9a | 2026-03-22 | MÉDIO | GistContactWizard.tsx | ~~useState manual~~ → useMutation + isPending (DT-1) | RESOLVIDO 2026-03-30 |
| DS1 | 2026-03-22 | MÉDIO | DemandsDashboardPage.tsx | ~~HSL hardcoded~~ → importa PRIORITY_CHART_COLORS de colorPalette.ts | RESOLVIDO 2026-03-30 |
| DS2 | 2026-03-22 | MÉDIO | ClientDetailPage.tsx:713 | ~~HSL hardcoded~~ → chart config corrigido. **RESIDUAL:** bg-green-500 em tone distribution bar | PARCIAL |
| O2 | 2026-03-08 | MÉDIO | SearchPage/ClientDetailPage/Index | ~~TONE_CONFIG duplicado~~ → centralizado em colorPalette.ts | RESOLVIDO 2026-03-30 |
| F16 | 2026-03-30 | MÉDIO | AppSidebar.tsx:50-56 | logoutMutation sem onError — user sem feedback se signOut falhar | ABERTO |
| F17 | 2026-03-30 | MÉDIO | DemandsDashboardPage.tsx:50-76 | blocked_demands query sem toast de erro | ABERTO |
| DS-R1 | 2026-03-30 | BAIXO | Index.tsx:273 | HSL hardcoded no ChartContainer — deve usar TONE_CHART_COLORS | ABERTO |

## Baixas

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| M13a | 2026-03-22 | BAIXO | — | Sem testes para process-jobs, classify-batch, ClientContext, interactions | ABERTO |
| DS5 | 2026-03-22 | BAIXO | Múltiplos | Zero uso de motion-safe: prefix | ABERTO |
| DS4 | 2026-03-22 | BAIXO | skeleton.tsx | ~~animate-pulse~~ → animate-shimmer (DT-1) | RESOLVIDO 2026-03-30 |
| A2 | 2026-03-08 | BAIXO | Audits.tsx | ~~key={i}~~ → key={`recipient-${r.value \|\| i}`} (DT-1) | RESOLVIDO 2026-03-30 |
| O1 | 2026-03-08 | BAIXO | useAuditRules.ts | ~~unknown~~ → string[] (DT-1) | RESOLVIDO 2026-03-30 |
| M11b | 2026-03-26 | BAIXO | AgendasPage, CreateAgendaDialog | ~~useQuery importado sem uso~~ → removido (DT-1) | RESOLVIDO 2026-03-30 |
| DSb1 | 2026-03-26 | BAIXO | SatisfactionPicker.tsx | ~~Cores hardcoded~~ → importa SATISFACTION_CONFIG (DT-1) | RESOLVIDO 2026-03-30 |
| DSb2 | 2026-03-26 | BAIXO | AgendasPage.tsx | ~~Sem animate-fade-in-up~~ → classe adicionada (DT-1) | RESOLVIDO 2026-03-30 |

## Resolvidas (desde última auditoria)

| ID | Data | Descrição | Resolução |
|----|------|-----------|-----------|
| A1 | 2026-03-08 | SearchPage.tsx TDZ | Issue #65 — fix aplicado |
| A3 | 2026-03-08 | CONTEXT.md Issue #13 inconsistente | CONTEXT.md v21 corrigido |
| O3 | 2026-03-08 | queryKey sem `limit` | Reclassificado como sem impacto |
| O4 | 2026-03-08 | Agente "Projeto" na Colaboração | Informacional — coexistem |
| O5 | 2026-03-08 | Changelog v8→v9 ausente | Informacional |
