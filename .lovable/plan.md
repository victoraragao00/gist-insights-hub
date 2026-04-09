

## Plan: Fix useClientDemands select to include all joins

### Problem
`useClientDemands` uses a limited `.select()` that doesn't fetch `id` fields or `clients` join. When `DemandDetailSheet` opens from `ClientDetailPage`, fields like Type, Column, Area, Assignee, and Client appear blank.

### Change — `src/hooks/useClientDemands.ts`

1. Update the `.select()` to use `*` and include all joins matching `useDemands` pattern:
   - `ticket_columns(id, name, color, triggers_started_at, triggers_finished_at)`
   - `demand_types(id, name, color, icon)`
   - `demand_areas(id, name, color)`
   - `user_profiles!assignee_id(id, full_name, email)`
   - `clients(id, name)`

2. Update `ClientDemand` interface to extend or align with `DemandRow` from `useDemands` (use `Tables<"demands">` base + join types), so the data is compatible with `DemandDetailSheet`.

### Files changed

| Action | File |
|--------|------|
| Edit | `src/hooks/useClientDemands.ts` |

### No changes to
- `useDemands`, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

