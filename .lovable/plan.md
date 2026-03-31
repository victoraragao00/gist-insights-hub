

## Plan: Fix Cancelled Counter + Clickable KPI Cards with Modal

### Root Cause — Cancelled ticket not counted

The ticket "Erro de Usabilidade" has **both** `cancellation_reason = 'Revisão estratégica'` AND `finished_at` set. The current RPC logic:
- `completed` = `finished_at IS NOT NULL` (catches this ticket)
- `cancelled` = `cancellation_reason IS NOT NULL AND finished_at IS NULL` (misses it)

**Fix:** `cancellation_reason IS NOT NULL` should take priority over `finished_at`. Cancelled = has `cancellation_reason`, regardless of `finished_at`. Completed = has `finished_at` AND no `cancellation_reason`.

### Changes

#### 1. Migration — Fix `get_demand_analytics` RPC

Update the totals section:
```sql
'open', (SELECT COUNT(*) FROM base WHERE finished_at IS NULL AND NOT COALESCE(is_blocked, false) AND cancellation_reason IS NULL),
'completed', (SELECT COUNT(*) FROM base WHERE finished_at IS NOT NULL AND cancellation_reason IS NULL),
'blocked', (SELECT COUNT(*) FROM base WHERE COALESCE(is_blocked, false) = true),
'cancelled', (SELECT COUNT(*) FROM base WHERE cancellation_reason IS NOT NULL)
```

Key change: `completed` now excludes cancelled tickets, and `cancelled` no longer requires `finished_at IS NULL`.

#### 2. `DemandsDashboardPage.tsx` — Clickable KPI cards + drill-down modal

- Upgrade `DashKPICard` to accept `onClick` and show cursor-pointer
- Add state for which KPI category is selected (`open | completed | blocked | cancelled | null`)
- When a KPI card is clicked, open a Dialog/modal
- Inside the modal: query `demands` table filtered by the category logic:
  - **Abertos**: `finished_at IS NULL`, `is_blocked = false`, `cancellation_reason IS NULL`
  - **Concluídos**: `finished_at IS NOT NULL`, `cancellation_reason IS NULL`
  - **Bloqueados**: `is_blocked = true`
  - **Cancelados**: `cancellation_reason IS NOT NULL` (via `not.is.null`)
- Display results in a table (title, client, priority, date) — reuse the same pattern as the blocked tickets table
- Total and Lead/Cycle Time cards remain non-clickable (no drill-down makes sense)

#### 3. Files changed

| Action | File |
|--------|------|
| Migration | Update `get_demand_analytics` RPC (fix cancelled/completed logic) |
| Edit | `src/pages/DemandsDashboardPage.tsx` (clickable KPIs + drill-down modal) |

#### No changes to
- Hooks, edge functions, RLS, `src/integrations/supabase/*`, `.env`

