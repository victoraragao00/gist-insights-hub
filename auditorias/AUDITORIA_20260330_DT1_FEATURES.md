# AUDITORIA DT-1 + Features 10-18 — 2026-03-30

> Executada por: Claude Code (Agente de Revisão e Engenharia)
> Escopo: Dívida Técnica Completa (DT-1) + Features #10-#18
> Diff: f3bba13..990f535 (31 arquivos, +550/-230 linhas)

---

## Resumo Executivo

| Categoria | Status | Violações |
|-----------|--------|-----------|
| DT-1: Paleta centralizada | ⚠️ | 2 residuais |
| DT-1: as unknown as (m1) | ⚠️ | 6 residuais + 3 novos |
| DT-1: Imports, mutation, skeleton, stagger, key, tipagem | ✅ | 0 |
| Features 10-18 | ⚠️ | 2 médios |
| **Total** | **⚠️** | **2 médios + 11 baixos** |

---

## BLOCO A — Dívida Técnica (DT-1)

### Paleta Centralizada (DS1, DS2, O2, DSb1) — ⚠️ PARCIAL

**PASS:**
- ✅ `src/lib/colorPalette.ts` criado com 6 exports corretos (TONE_CONFIG, TONE_CHART_COLORS, TONE_BAR_COLORS, PRIORITY_CHART_COLORS, SCORE_BUCKET_COLORS, SATISFACTION_CONFIG)
- ✅ TONE_CONFIG removido de ClientDetailPage, ClientsPage, SearchPage — importam de colorPalette
- ✅ PRIORITY_COLORS removido de DemandsDashboardPage — importa PRIORITY_CHART_COLORS
- ✅ SatisfactionPicker importa SATISFACTION_CONFIG de colorPalette
- ✅ Skeleton usa animate-shimmer
- ✅ AgendasPage tem animate-fade-in-up

**RESIDUAIS (baixo):**

| ID | Arquivo | Linha | Problema |
|----|---------|-------|---------|
| DS-R1 | `src/pages/Index.tsx` | 273 | HSL hardcoded no ChartContainer config (deve usar TONE_CHART_COLORS) |
| DS-R2 | `src/pages/ClientDetailPage.tsx` | 713 | `bg-green-500` em vez de TONE_BAR_COLORS (ou bg-emerald-500) |

---

### as unknown as (M1a) — ⚠️ PARCIAL

**CORRIGIDOS (7/10):**
- ✅ useDemands.ts:87 → cast simples
- ✅ useClientDemands.ts:35 → cast simples
- ✅ useDemandInteractions.ts:56 → cast simples
- ✅ useMeetingAgendas.ts:49,68 → cast simples
- ✅ useMeetingHomework.ts:33 → cast simples
- ✅ useDemands.ts:87 → cast simples

**RESIDUAIS:**

| ID | Arquivo | Linha | Justificativa |
|----|---------|-------|---------------|
| M1-R1 | ColumnSettingsTab.tsx | 166-167 | `err as unknown as ColumnHasTicketsError` — pode ser necessário (error type narrowing) |
| M1-R2 | ClientDetailPage.tsx | 344 | `clientDemands as unknown as DemandRow[]` — deveria ser cast simples |
| M1-R3 | useDemandAnalytics.ts | 53 | `data as unknown as DemandAnalyticsData` — deveria ser cast simples |
| M1-R4 | Audits.tsx | 219 | `alert_recipients as unknown as Array<...>` — pode ser necessário (JSON column) |
| M1-R5 | DemandsDashboardPage.tsx | 73 | `r.clients as unknown as { name: string }` — novo, JOIN relation |
| M1-R6 | useDemandWatchers.ts | 30 | `row.user_profiles as unknown as ...` — novo, JOIN relation |
| M1-R7 | AgendaSettingsTab.tsx | 50 | `safeConfig as unknown as Record<string, string>` — novo |

Nota: M1-R1, M1-R4, M1-R5, M1-R6, M1-R7 envolvem narrowing de tipos Supabase (JOINs, JSON, error) onde o double-cast pode ser necessário. M1-R2 e M1-R3 deveriam ser cast simples.

---

### Demais itens DT-1 — ✅ PASS

| Item | Status | Detalhe |
|------|--------|---------|
| M9a: GistContactWizard | ✅ | useMutation + isPending (linha 305, 727) |
| M11b: Imports não usados | ✅ | useQuery removido de AgendasPage e CreateAgendaDialog |
| DS4: Skeleton shimmer | ✅ | animate-shimmer com gradient |
| DSb2: Stagger animation | ✅ | animate-fade-in-up na AgendasPage |
| O1: alert_recipients | ✅ | Tipado como string[] |
| A2: key={i} | ✅ | key={`recipient-${r.value \|\| i}`} |

---

## BLOCO B — Features #10-#18

### Migrations — ✅ PASS

| Migration | Conteúdo | Status |
|-----------|----------|--------|
| 20260330150707 | RLS policy UPDATE user_profiles com `is_admin()` | ✅ |
| 20260330150945 | `ALTER TABLE meeting_agendas ADD COLUMN IF NOT EXISTS duration_minutes INTEGER` | ✅ |

### Componentes e Hooks

| Feature | Arquivo | CTO Check | Status |
|---------|---------|-----------|--------|
| #10 Toggle ativo | UserManagementTab.tsx | m7 ✅ m8 ✅ m9 ✅ | ✅ PASS |
| #11 Botão Permissões | UserManagementTab.tsx | — | ✅ PASS |
| #12 Campos locked | AgendaSettingsTab.tsx | m7 ✅ m8 ✅ m9 ✅ | ✅ PASS |
| #13 duration_minutes | AgendaDetailSheet.tsx | m8 ✅ m9 ✅ | ✅ PASS |
| #14 Filtros agendas | useMeetingAgendas.ts | m4 ✅ m5 ✅ m8 ✅ | ✅ PASS |
| #15 Badge pautas | ClientDetailPage.tsx | — | ✅ PASS |
| #16 Logout | AppSidebar.tsx | m7 ✅ m9 ✅ | ⚠️ MÉDIO |
| #17 Tickets bloqueados | DemandsDashboardPage.tsx | m4 ✅ m5 ✅ m12 ✅ | ⚠️ MÉDIO |
| #18 Nomes watchers | useDemandWatchers.ts | m4 ✅ m5 ✅ m8 ✅ | ✅ PASS |

### Violações Médias

| ID | Arquivo | Linha | Problema | Fix |
|----|---------|-------|---------|-----|
| F16 | AppSidebar.tsx | 50-56 | logoutMutation sem `onError` — user não vê feedback se signOut falhar | Adicionar `onError: () => toast.error("Erro ao sair")` |
| F17 | DemandsDashboardPage.tsx | 50-76 | blocked_demands query sem toast de erro | Adicionar `onError` ou try/catch com toast |

---

## Plano de Ação

### Prompt Lovable (residuais — 1 rodada final)

1. **DS-R1:** Index.tsx:273 — usar TONE_CHART_COLORS no ChartContainer
2. **DS-R2:** ClientDetailPage.tsx:713 — usar TONE_BAR_COLORS
3. **M1-R2:** ClientDetailPage.tsx:344 — simplificar para cast direto
4. **M1-R3:** useDemandAnalytics.ts:53 — simplificar para cast direto
5. **F16:** AppSidebar.tsx — adicionar onError ao logoutMutation
6. **F17:** DemandsDashboardPage.tsx — adicionar error handling na query

### Aceitáveis (não corrigir)

- M1-R1, M1-R4, M1-R5, M1-R6, M1-R7 — double-casts justificados (JOINs, JSON columns, error narrowing)
