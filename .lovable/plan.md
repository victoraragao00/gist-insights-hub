

## Plan: Monitoramento de SLA na página de Demandas

### Overview

Add SLA first-response monitoring as an alternative view in the Demands page. Includes a new `sla_configs` table, a `sla_first_response_at` column on `demands`, a DB function + trigger, a new hook, and a new SLA view component with KPIs, list and kanban sub-views.

### 1. Migration

- Create `sla_configs` table with RLS (select for accessible clients, manage for admin)
- Seed global defaults (urgent=2h, high=4h, medium=8h, low=24h)
- Add `sla_first_response_at TIMESTAMPTZ` column to `demands`
- Create `get_demands_with_sla(uuid)` RPC function (SECURITY DEFINER, returns open demands with SLA calculations)
- Create `mark_sla_first_response()` trigger on `demands` BEFORE UPDATE — sets `sla_first_response_at = now()` when ticket moves to a column with `triggers_started_at = true`
- Note: The CHECK constraint on `priority` uses text values matching the `demand_priority` enum

### 2. New hook — `src/hooks/useSla.ts`

- `useSlaDemandsBoard()` — calls `get_demands_with_sla` RPC
- `staleTime: 30_000`, `refetchInterval: 60_000`
- Exports `DemandWithSla` interface
- Uses `useAuth()` for user ID

### 3. New component — `src/components/demands/SlaView.tsx`

- 3 KPI cards at top: Vencidos (red), Em risco (yellow), No prazo (green)
- Toggle between Lista and Kanban sub-views
- **Lista view**: Cards with title, client, column, assignee, SLA progress bar (colored by status), remaining time
- **Kanban sub-view** (`KanbanSlaView`): Groups demands by `column_name`, each card has a 3px colored top bar indicating SLA status + time remaining badge
- `SLA_STATUS_CONFIG` for colors/labels, `formatSlaTime()` helper
- Click on demand opens `DemandDetailSheet`
- Empty state: "Todos os tickets estão com SLA cumprido 🎉"

### 4. Edit `src/pages/DemandsPage.tsx`

- Add `view` state: `"kanban" | "sla"`
- Add Kanban/SLA toggle buttons in header (Clock icon for SLA)
- Red badge on SLA button showing count of `vencido` demands (from a lightweight query or the SLA hook)
- Conditionally render existing Kanban board or `<SlaView />`
- Hide Kanban filters when SLA view is active
- Import `SlaView`, `Clock`, `LayoutGrid` from lucide

### Files changed

| Action | File |
|--------|------|
| Migration | `sla_configs` table + `sla_first_response_at` column + RPC + trigger |
| New | `src/hooks/useSla.ts` |
| New | `src/components/demands/SlaView.tsx` |
| Edit | `src/pages/DemandsPage.tsx` (view toggle + conditional render) |

### No changes to
- `useDemands`, existing Kanban components, other pages, `src/integrations/supabase/*`, `.env`

