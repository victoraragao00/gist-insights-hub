

## Problem

The `ingest-gist-historical` function only fetched 20 conversations (1 page) because:
1. **No logging** — we can't see what Gist's API returned for `total_count` / `totalPages`
2. **Likely API default** — Gist's `/conversations` endpoint probably defaults to `state=open`, returning only active conversations instead of the full history

## Plan

### 1. Add console.log debugging to the edge function

Add strategic logs so we can see:
- The raw `pages` object from Gist's response (`total_count`, `per_page`, `page`)
- Calculated `totalPages` vs `currentPage`
- The `has_more` / `nextPage` decision

### 2. Fetch ALL conversation states

Change the Gist API call to include closed/archived conversations:
```
GET /conversations?page=1&per_page=20&state=all
```
If `state=all` doesn't work in the Gist API, try omitting `state` or using multiple states.

### 3. Redeploy and test

Deploy the updated function, then run the import again to see the actual numbers.

### Changes

**File: `supabase/functions/ingest-gist-historical/index.ts`**
- Add `console.log` for API response metadata (pages object, totalPages calc, hasMore decision)
- Add `state: 'all'` (or equivalent) to the conversations API call parameters
- Redeploy

No frontend changes needed — the loop logic is already correct.

