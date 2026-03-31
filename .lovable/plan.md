

## Plan: Fix Watchers — PGRST200 (no FK) + 23505 (duplicate insert)

### Root Cause

**PGRST200**: The query in `useDemandWatchers.ts` line 25 does `.select("..., user_profiles(full_name, email)")` — PostgREST requires a foreign key relationship to resolve this join. There is **no FK** from `demand_watchers.user_id` → `user_profiles.id`.

**23505**: When the watcher query fails (PGRST200), the `watchers` array stays empty, so `isWatching` is always `false`. The button always shows "Observar" and always tries to INSERT, causing a duplicate key violation on the second click.

### Fix (2 changes)

#### 1. Migration — Add FK from `demand_watchers.user_id` to `user_profiles.id`

```sql
ALTER TABLE public.demand_watchers
  ADD CONSTRAINT demand_watchers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
```

This enables PostgREST to resolve the `user_profiles(...)` embedded select. No other table/policy changes needed.

#### 2. Hook — Add optimistic update to prevent 23505

In `useDemandWatchers.ts`, add `onMutate` with optimistic cache update so the button state flips immediately (before the server round-trip), preventing double-click issues:

```typescript
onMutate: async (isWatching) => {
  await queryClient.cancelQueries({ queryKey: ["demand_watchers"] });
  // snapshot + optimistic update of the specific query
},
onError: (_err, _vars, context) => {
  // rollback to snapshot
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ["demand_watchers"] });
},
```

### Files changed
- **New migration** (FK constraint)
- **Edit:** `src/hooks/useDemandWatchers.ts` (optimistic update in `useToggleWatcher`)

### No changes to
- `DemandDetailSheet.tsx` (UI code is already correct)
- RLS policies, other migrations, `src/integrations/supabase/*`, `.env`

