

# Issue #8 — classify_batch: timeout, JSON recovery, auto-chain limit

Three targeted fixes in `supabase/functions/process-jobs/index.ts`:

---

## 1. AbortSignal.timeout on AI fetch calls

**Gemini** (line 581): add `signal: AbortSignal.timeout(30_000)` to the fetch options.

**Claude** (line 653): add `signal: AbortSignal.timeout(45_000)` to the fetch options.

This prevents the function from hanging indefinitely if either API stalls.

---

## 2. parseWithRecovery for JSON.parse

Add a `parseWithRecovery` helper function near the top of the file that:
- Tries `JSON.parse(text)` first
- On failure, finds the last `}` and appends `]` to recover truncated arrays
- Logs a warning with the number of recovered items

Replace the bare `JSON.parse(text)` calls:
- **Line 634** (Gemini): `classifications = parseWithRecovery(text)`
- **Line 673** (Claude): `classifications = parseWithRecovery(cleaned)`

Both wrapped in try/catch so a parse failure logs the error and falls through to the next provider (or throws if both fail).

---

## 3. MAX_BATCHES_PER_JOB limit on auto-chaining

Add a `MAX_BATCHES_PER_JOB = 50` constant (1,000 interactions cap per job).

Track `batches_processed` in `job.progress` (accumulative across auto-chain calls). In `handleClassifyBatch`, check at the start:

```text
batchesProcessed = (job.progress?.batches_processed ?? 0) + 1
if batchesProcessed > MAX_BATCHES_PER_JOB → return has_more: false
```

Include `batches_processed` in the returned progress so it persists across chains. When the limit is hit, the job completes and `pg_cron` creates a fresh one next cycle.

---

## Files changed

- `supabase/functions/process-jobs/index.ts` — all 3 fixes
- `CONTEXT.md` — mark issue #8 resolved

After editing, re-deploy the `process-jobs` Edge Function.

