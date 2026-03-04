

# Fix `ingest-gist-historical` — correct client resolution

## Current problem

The function uses a "frequency-based" heuristic to resolve `client_id` per conversation, with a **fallback to the first active gist binding** (`firstActiveBinding`). This causes all unresolved conversations to be dumped into `a333ad32...` (umode.com.br) — 19,771 wrongly assigned interactions.

## New resolution logic

For each conversation:

1. Find the **first message** where `author.type === 'contact'` — this is the inbound participant
2. Look up that contact's Gist ID in the `participants` table (via `gistIdToParticipant` map)
3. If found and participant has `side === 'client'` → use that participant's `client_id`
4. If found but participant has `side === 'umode'` → set `client_id = NULL` (internal message)
5. If not found in participants → set `client_id = NULL` (quarantine)
6. **No fallback** — never assign to a default binding

## Changes

**File:** `supabase/functions/ingest-gist-historical/index.ts`

- Expand `Participant` interface to include `side: string`
- Load `side` field in the participants query
- Store `side` in the `gistIdToParticipant` map
- Remove `firstActiveBinding` fallback
- Remove frequency-based client resolution block (lines 229-246)
- Replace with: find first contact-type author → lookup participant → resolve client_id (or null)
- Also resolve `channel_binding_id` from `bindingByClientId` if client_id is known, otherwise null
- Allow `client_id: null` in the upsert rows (column is NOT NULL — need to check)

**Post-deploy steps (via edge function invocation + DB query):**
1. `DELETE FROM interactions WHERE client_id = 'a333ad32-6295-4ac5-a15f-6d3931130315'`
2. Re-run the import to re-insert with correct resolution

## Concern: `client_id` is NOT NULL

The `interactions` table has `client_id uuid NOT NULL`. Quarantined/umode messages with `client_id = NULL` will fail the insert. I need to handle this:

- **Option A**: Skip these messages entirely (don't insert)
- **Option B**: Alter column to allow NULL

I'll use **Option A** (skip) — messages without a resolved client are not useful in the UI and can be re-processed later if needed. The response will report `messages_quarantined` count.

