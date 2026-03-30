

## Plan: Fix RLS Recursion + Build Error

### 1. Migration — Fix `user_client_access` infinite recursion

Drop 4 recursive policies and recreate using `is_admin()`:

```sql
DROP POLICY IF EXISTS user_client_access_admin_select ON user_client_access;
DROP POLICY IF EXISTS user_client_access_admin_insert ON user_client_access;
DROP POLICY IF EXISTS user_client_access_admin_update ON user_client_access;
DROP POLICY IF EXISTS user_client_access_admin_delete ON user_client_access;

CREATE POLICY user_client_access_admin_select
  ON user_client_access FOR SELECT
  USING (is_admin() OR user_id = auth.uid());

CREATE POLICY user_client_access_admin_insert
  ON user_client_access FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY user_client_access_admin_update
  ON user_client_access FOR UPDATE
  USING (is_admin());

CREATE POLICY user_client_access_admin_delete
  ON user_client_access FOR DELETE
  USING (is_admin());
```

### 2. Build fix — `process-jobs/index.ts` line 588

The `Set` constructor infers `unknown[]` because Supabase returns untyped rows. Fix by adding explicit type annotation to the `.map()` callback return and the `filter` predicate — the line already has the right logic, but TS needs the `Set<string>` generic:

```typescript
const distinctConvIds: string[] = [...new Set<string>(
  (convRows ?? []).map((r: { conversation_id: string }) => r.conversation_id)
    .filter((id: string | null): id is string => typeof id === 'string' && id.length > 0)
)];
```

### Files changed
- **New migration** via migration tool (RLS fix)
- **Edit:** `supabase/functions/process-jobs/index.ts` line 588 (type fix)

### No changes to
- Frontend code, other edge functions, `src/integrations/supabase/*`, `.env`

