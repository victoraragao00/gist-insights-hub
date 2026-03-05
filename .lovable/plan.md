

## Fix: Backfill `auto_created` for existing clients

### Root cause
The `sync-gist-contacts` edge function already sets `auto_created: true` when creating new clients (line 173). But all existing clients were created **before** this code existed, so they're missing the flag. The `deactivate_stale_clients` function correctly filters on `auto_created = 'true'` — that safety net must stay.

### What needs to happen

**1. Database migration — backfill `auto_created` on domain-based clients**

All domain-based slugs end with patterns like `-com-br`, `-com`, `-ind-br`, `-net`, `-edu`, etc. The two "real" clients have simple slugs: `bynv` and `osklen`.

```sql
UPDATE clients
SET metadata = metadata || '{"auto_created": true, "source": "gist_sync"}'::jsonb
WHERE (
  slug LIKE '%-com-br'
  OR slug LIKE '%-com'
  OR slug LIKE '%-ind-br'
  OR slug LIKE '%-net'
  OR slug LIKE '%-edu'
  OR slug LIKE '%-senai-br'
)
AND slug NOT IN ('bynv', 'osklen');
```

This tags ~240+ domain-based clients as `auto_created` without touching By NV or Osklen.

**2. No edge function changes needed**

The `sync-gist-contacts/index.ts` already:
- Sets `metadata: { auto_created: true, source: 'gist_sync' }` on insert (line 173)
- Preserves existing metadata with spread on update (line 351-354)

**3. No changes to `deactivate_stale_clients`**

The function stays as-is with the `auto_created` filter.

**4. `src/pages/SettingsPage.tsx` — update description text**

Change the inactivation card description from current text to:
> "Inativa clientes criados automaticamente (via sincronização) sem acesso no período configurado."

This accurately reflects what the function does.

### Files modified
- New database migration (backfill SQL)
- `src/pages/SettingsPage.tsx` — minor text update

