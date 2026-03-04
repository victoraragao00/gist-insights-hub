

# New Edge Function: `sync-gist-contacts`

## Overview

Create `supabase/functions/sync-gist-contacts/index.ts` — a single new file that syncs all Gist contacts into the database, auto-resolving company/client via `company_name` or email domain. Add config entry to `supabase/config.toml`.

## Files Changed

1. **`supabase/functions/sync-gist-contacts/index.ts`** — new file (entire function)
2. **`supabase/config.toml`** — add `[functions.sync-gist-contacts]` with `verify_jwt = false`

## Algorithm Summary

1. Authenticate caller via JWT (extract `user_id`)
2. Pre-load all existing `clients` (slug → record map)
3. Paginate Gist contacts (`per_page=60`, 150ms delay, 429 retry, stop if `last_seen_at` > 2 years ago)
4. Per contact, resolve company in priority order:
   - **P1**: `custom_properties.company_name` → slug
   - **P2**: email domain (skip generic list) → match by slug or use domain as name
   - **P3**: unresolvable → `client_id = NULL`, skip client creation
5. For resolved contacts:
   - Find-or-create client by slug (set `metadata.auto_created = true`)
   - Upsert participant (match by `identifiers @> [{channel:"gist", value:id}]`)
   - Track `last_seen_at` per client
6. Post-loop:
   - Update `clients.metadata.last_seen_at` for each touched client
   - Grant `user_client_access` (admin) to caller for new clients
   - Set `active = false` on auto-created clients with `last_seen_at` > 90 days ago
7. Return `SyncResult` JSON

## Key patterns (from existing codebase)
- JSONB filter: `.filter("identifiers", "cs", JSON.stringify([...]))`
- Rate limit: 150ms between pages, 2s retry on 429
- Service role for writes, anon client for auth check
- `last_seen_at` parsing handles unix timestamp, ISO string, and null

No other files will be touched.

