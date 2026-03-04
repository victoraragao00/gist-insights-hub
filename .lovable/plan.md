

## Diagnosis

The Edge Function logs confirm:
- Pagination works correctly (pages 1→9, 60 contacts each, `pages.next` detected properly)
- Function gets **killed by wall-clock timeout** (~150s) at page 9 before returning a response
- 31 total pages × ~20s per page = ~10 min, far exceeding the 150s limit
- The "Failed to send a request" error is the client seeing the connection drop

## Solution: Reduce batch size + frontend auto-loop

Instead of trying to process all 31 pages in one invocation, process **5 pages per call** (~100s, safely under 150s) and let the frontend chain calls automatically.

### 1. Backend: `sync-gist-contacts/index.ts`
- Change `DEFAULT_MAX_PAGES` from 50 to **5**
- No other changes needed -- the pagination logic and `has_more`/`next_page` response already support this

### 2. Frontend: `InteractionsPage.tsx`  
- Already has the auto-loop logic (`while result.has_more, call again with next_page`)
- Change the `max_pages` in the request body from 50 to **5**
- Add a small delay (1s) between batch calls to avoid hammering

### Expected behavior
- Each call: 5 pages × 60 contacts = 300 contacts in ~100s
- Frontend chains: batch 1 (pages 1-5), batch 2 (pages 6-10), ... batch 7 (pages 31)
- Total: ~7 sequential calls, all completing successfully
- UI shows progress after each batch

