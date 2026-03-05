

## Problem

The `ingest-gist-historical` function itself works correctly (logs confirm pages 245→275/294 processing fine). The issue is the **frontend loop losing state** when the preview page reloads or disconnects during the ~10-minute import process.

## Fix: Add resume capability to the frontend

### 1. Frontend: `src/pages/InteractionsPage.tsx`

- **Remove the `delete_client_id` from automatic first-call behavior** — make it a separate explicit button so re-runs don't wipe data
- **Add a "resume page" input** — let user specify starting page (default 1) so if the loop breaks at page 275, they can resume from 276
- **Persist last known page in `localStorage`** — automatically save `next_page` after each batch so on refresh, the UI shows where it stopped
- **On mount, check localStorage** for a saved page and offer to resume

### 2. Separate "Limpar dados" button

- Move the delete logic to a separate button so it's explicit and doesn't run on every retry
- This prevents accidentally wiping already-imported data when resuming

### 3. Show progress as percentage

- Since we know totalPages=294, show `página X/294` in the progress log
- Add the total pages to the edge function response so the frontend can display progress percentage

### Changes

**`supabase/functions/ingest-gist-historical/index.ts`**:
- Add `total_pages` to the response JSON (extracted from `last` URL)

**`src/pages/InteractionsPage.tsx`**:
- Add `startPage` state with localStorage persistence
- Add separate "Limpar interações" button for the delete operation
- Show resume prompt if localStorage has a saved page
- Display progress as `página X/totalPages`

