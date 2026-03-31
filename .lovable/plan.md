

## Plan: Fix Dashboard Contadores (Bloqueados + Open/Completed/Cancelled)

### Root Cause Analysis

**Issue 2 — Cancelled/Completed counted as open:**
The `open` counter in `get_demand_analytics` uses `finished_at IS NULL AND NOT is_blocked`. However, the "Cancelado" column has `triggers_finished_at = false`, so demands moved there never get `finished_at` set. They appear as "open" in the dashboard.

Similarly, `completed` only counts `triggers_finished_at = true AND finished_at IS NOT NULL`, missing any demand in a terminal column that doesn't trigger finished_at.

**Issue 1 — Blocked count may be 0 incorrectly:**
If the RPC returns 0 blocked despite data showing 1, it could be a caching issue (staleTime: 120s) or the `user_accessible_client_ids` not returning the client. But based on the SQL test, the logic itself works. The more likely issue is that the blocked demand was added after the last RPC cache refresh. Reducing staleTime and ensuring the data is correct in the RPC logic should fix this.

### Fix — Migration to update `get_demand_analytics` RPC

Replace the totals calculation with logic that accounts for terminal columns:

```sql
CREATE OR REPLACE FUNCTION public.get_demand_analytics(...)
```

Key changes in the totals section:

- **`completed`**: Count demands where `finished_at IS NOT NULL` (any demand that reached a column with `triggers_finished_at = true`)
- **`cancelled`**: Add new counter — demands in columns where the column name is 'Cancelado' (or better: add a `triggers_cancelled` boolean to ticket_columns, but for now use column name match or a simpler approach: demands with `cancellation_reason IS NOT NULL`)
- **`open`**: Total minus completed minus blocked minus cancelled

Actually, the simplest correct approach without schema changes:
- **`open`** = demands where `finished_at IS NULL AND NOT is_blocked AND cancellation_reason IS NULL`
- **`completed`** = demands where `finished_at IS NOT NULL`
- **`cancelled`** = demands where `cancellation_reason IS NOT NULL AND finished_at IS NULL` (new field in totals)

Wait — let me reconsider. The `demands` table has a `cancellation_reason` column. Let me check if cancelled demands actually have this set.

Better approach: use `finished_at IS NOT NULL` for completed (already works for Concluído). For Cancelado, since that column doesn't set `finished_at`, we need another indicator. The `cancellation_reason` field exists. But if it's not reliably set, we should check the column name.

**Simplest reliable fix:** Join with `ticket_columns` (already done in `base` CTE) and check column properties:
- `completed` = `finished_at IS NOT NULL` (covers Concluído)
- `open` = `finished_at IS NULL AND NOT is_blocked` — but we need to also exclude Cancelado

Since there's no `triggers_cancelled` flag, we'll use the column name or add a flag. For now, the cleanest fix is to add an `is_terminal` boolean to `ticket_columns` or simply check if the column is "Cancelado" by name.

**Proposed approach — add `is_terminal` to ticket_columns:**

Actually the simplest fix without schema changes: count demands in the "Cancelado" column as neither open nor completed. We can detect this by checking if `cancellation_reason IS NOT NULL` OR if the column name matches terminal non-finished patterns.

### Final approach — Migration only

Update the `get_demand_analytics` function:

```sql
'open', (SELECT COUNT(*) FROM base 
  WHERE finished_at IS NULL 
  AND NOT COALESCE(is_blocked, false)
  AND cancellation_reason IS NULL),
'completed', (SELECT COUNT(*) FROM base WHERE finished_at IS NOT NULL),
'blocked', (SELECT COUNT(*) FROM base WHERE COALESCE(is_blocked, false) = true),
'cancelled', (SELECT COUNT(*) FROM base WHERE cancellation_reason IS NOT NULL AND finished_at IS NULL)
```

And update the frontend to show the cancelled count.

### Frontend change — `DemandsDashboardPage.tsx`

Add a "Cancelados" KPI card after "Bloqueados" (making it 7 cards total, or replace one). Update the TypeScript interface in `useDemandAnalytics.ts` to include `cancelled: number`.

### Files changed

| Action | File |
|--------|------|
| Migration | Update `get_demand_analytics` RPC (fix open/completed/cancelled/blocked counts) |
| Edit | `src/hooks/useDemandAnalytics.ts` (add `cancelled` to `DemandAnalyticsTotals`) |
| Edit | `src/pages/DemandsDashboardPage.tsx` (add Cancelados KPI card) |

### No changes to
- Edge Functions, RLS policies, `src/integrations/supabase/*`, `.env`

