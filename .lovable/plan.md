

## Plan: Análise de IA por Demanda (Resolution + AI Analyses)

### Overview

Add AI-powered demand analysis: a `resolution` field on demands, a `demand_ai_analyses` table, an `analyze-demand` Edge Function using Lovable AI Gateway (Gemini 2.5 Flash), and UI integration in both DemandDetailSheet and CreateDemandDialog.

**Note:** Per project standards, the Lovable AI Gateway will be used instead of direct Gemini API calls. The prompt specifies `GEMINI_API_KEY` but the gateway approach (already proven in `summarize-conversation`) is more reliable and consistent.

---

### 1. Database Migration

Single migration:
- `ALTER TABLE demands ADD COLUMN IF NOT EXISTS resolution TEXT`
- `CREATE TABLE demand_ai_analyses` with columns: id, demand_id (FK CASCADE), problem_summary, suggested_resolution, context_used (JSONB), generated_at, created_by
- `UNIQUE(demand_id)` constraint
- RLS policies (select/insert/delete) scoped via `user_accessible_client_ids(auth.uid())`
- Index on `demand_id`

### 2. Edge Function: `supabase/functions/analyze-demand/index.ts`

Follow the same pattern as `summarize-conversation/index.ts`:
- Auth via JWT extraction + `getUser(token)`
- CORS via `ALLOWED_ORIGIN`
- Input: `{ demand_id }`
- Context gathering (via service role client):
  1. Demand: title, description, expected_result, resolution
  2. Client documents: title, description, category
  3. Client rules (active): description
  4. Global audit rules (active): metric, operator, threshold, description
  5. Linked conversations: demand_interactions → interactions (strip HTML)
  6. Resolution history: last 5 demands with resolution from same client
- Call Lovable AI Gateway (`google/gemini-2.5-flash`) with structured prompt requesting JSON output
- Parse JSON response, handle parse errors with fallback
- Upsert into `demand_ai_analyses` with `ON CONFLICT (demand_id) DO UPDATE`
- Return `{ problem_summary, suggested_resolution, generated_at }`
- Sanitized logs (never log content)
- Handle 429/402 from gateway

Add to `supabase/config.toml`:
```toml
[functions.analyze-demand]
  verify_jwt = false
```

### 3. Hook: `src/hooks/useDemandAnalysis.ts`

- `useDemandAnalysis(demandId)` — useQuery with `staleTime: 0`, `maybeSingle()`
- `useAnalyzeDemand()` — useMutation calling the edge function, invalidates query on success, toast feedback

### 4. Frontend Changes

**DemandDetailSheet.tsx:**
- Add `resolution` state + sync in useEffect (line ~291)
- Add Resolution textarea after Notes (line ~584), with save-on-blur pattern
- Add AI Analysis section after Resolution: button "Analisar com IA" / "Reanalisar" + result card with problem_summary, suggested_resolution, generated_at
- Import `useDemandAnalysis`, `useAnalyzeDemand` hooks and `Sparkles` icon (already imported)

**CreateDemandDialog.tsx:**
- After successful creation, store `createdDemandId` in state
- Show post-creation view with "Analisar com IA" button + analysis card
- "Fechar" button to dismiss

---

### Files changed

| Action | File |
|--------|------|
| Migration | Add `resolution` column + `demand_ai_analyses` table + RLS + index |
| New | `supabase/functions/analyze-demand/index.ts` |
| New | `src/hooks/useDemandAnalysis.ts` |
| Edit | `src/components/demands/DemandDetailSheet.tsx` (resolution field + AI card) |
| Edit | `src/components/demands/CreateDemandDialog.tsx` (post-creation AI analysis) |
| Edit | `supabase/config.toml` (add analyze-demand entry) |

### No changes to
- `src/integrations/supabase/*`, `.env`, other hooks or edge functions

