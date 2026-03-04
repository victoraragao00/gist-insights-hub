

## Plan: Fix ingest-gist-historical timeout + add frontend auto-loop

### 1. Backend: `supabase/functions/ingest-gist-historical/index.ts`

- Add `max_pages` parameter (default 5) to `RequestBody`
- Replace single-page fetch with a loop that processes up to `max_pages` conversation pages per invocation
- Accumulate totals across pages within the batch
- Return `has_more` / `next_page` based on whether more conversation pages exist beyond what was processed
- Keep existing per-conversation message pagination (fetch all messages for each conversation) unchanged

### 2. Frontend: `src/pages/InteractionsPage.tsx`

- Add a second test button "Importar histórico Gist" that:
  1. First DELETEs interactions for client `a333ad32-6295-4ac5-a15f-6d3931130315` via supabase client (using service role through edge function, or direct delete if RLS allows — will use the admin's auth context)
  2. Loops calling `ingest-gist-historical` with `{ page, max_pages: 5 }` 
  3. Chains calls while `has_more === true`, using `next_page`
  4. Accumulates and displays: `conversations_fetched`, `messages_inserted`, `messages_quarantined`, `errors`
  5. Shows real-time progress log (same pattern as sync-gist-contacts)
  6. 1s delay between batches

### 3. Delete approach

Since the interactions table has no DELETE RLS policy for authenticated users, the delete will be done inside the edge function itself (using service role). Add an optional `delete_client_id` parameter — if provided, delete all interactions for that client before starting ingestion.

### 4. Deploy

Redeploy `ingest-gist-historical` after changes.

