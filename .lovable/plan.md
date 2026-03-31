

## Plan: Conversas Vinculadas — Resumo IA + Cards + Vincular Inteira

### Overview

Upgrade the "Conversas Vinculadas" section with conversation summary cards, AI-powered summarization via Gemini, full-conversation linking option, and HTML content rendering fix.

---

### 1. Migration — `demand_conversation_summaries` table

```sql
CREATE TABLE public.demand_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(demand_id, conversation_id)
);
ALTER TABLE public.demand_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY summaries_select ON public.demand_conversation_summaries
  FOR SELECT TO authenticated USING (
    demand_id IN (SELECT d.id FROM demands d WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid())))
  );
CREATE POLICY summaries_insert ON public.demand_conversation_summaries
  FOR INSERT TO authenticated WITH CHECK (
    demand_id IN (SELECT d.id FROM demands d WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid())))
    AND created_by = auth.uid()
  );
CREATE POLICY summaries_delete ON public.demand_conversation_summaries
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX idx_conv_summaries_demand ON public.demand_conversation_summaries(demand_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.demand_conversation_summaries;
```

---

### 2. Edge Function — `supabase/functions/summarize-conversation/index.ts`

- **Auth:** Extract JWT via `getClaims()`, reject 401 if invalid
- **CORS:** Use `ALLOWED_ORIGIN` env var (per project memory)
- **Input (POST):** `{ demand_id, conversation_id }`
- **Logic:**
  1. Fetch messages from `interactions` where `conversation_id` matches, ordered by `occurred_at ASC`
  2. Strip HTML tags from `content` with regex (`/<[^>]*>/g`)
  3. Call Gemini `gemini-2.0-flash` via `GEMINI_API_KEY` with the structured CX analyst prompt
  4. Upsert result into `demand_conversation_summaries` with `ON CONFLICT (demand_id, conversation_id) DO UPDATE`
  5. Return `{ summary, generated_at }`
- **Error handling:** try/catch, sanitized logs (no message content in logs)
- Add to `supabase/config.toml` with `verify_jwt = false` (JWT validated in code)

---

### 3. New Hook — `src/hooks/useDemandConversationSummaries.ts`

- `useConversationSummaries(demandId)` — fetches all summaries for a demand, queryKey `["conv_summaries", demandId]`, staleTime 30_000
- `useSummarizeConversation()` — mutation calling the edge function, invalidates `["conv_summaries"]` on success, toast on error

---

### 4. Edit `src/components/demands/LinkConversationDialog.tsx`

In step 1 (conversation list), add two buttons per conversation card:
- **"Vincular inteira"** — selects all messages and immediately calls `linkMutation.mutate()` (skips step 2)
- **"Selecionar mensagens"** — current behavior (goes to step 2)

Replace the single `onClick={() => handleSelectConv(conv)}` with a row containing both buttons.

---

### 5. Edit `src/components/demands/DemandDetailSheet.tsx` (lines 686-776)

Replace the `convGroups` rendering block with the new card design:

- **Card header:** `MessageSquare` icon + first client sender name (fallback to truncated convId) + badge with msg count + relative date
- **AI Summary section:** If summary exists, show in `bg-muted/50` card with "Gerado há X" timestamp
- **Summarize button:** Full-width outline button with `Sparkles` icon — "Resumir com IA" or "Regenerar resumo"
- **Collapsible messages:** Use shadcn `Collapsible` to hide messages by default, with `ChevronDown` trigger "Ver mensagens (N)"
- **HTML fix:** Replace `{li.interactions?.content}` with `dangerouslySetInnerHTML={{ __html: li.interactions?.content ?? "—" }}`
- **Unlink button:** Preserved per message (existing AlertDialog pattern)

New imports needed: `Sparkles`, `ChevronDown` from lucide-react; `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from UI; the new summary hooks.

---

### Files Summary

| Action | File |
|--------|------|
| Migration | New migration (1 table + RLS + index + realtime) |
| New | `supabase/functions/summarize-conversation/index.ts` |
| New | `src/hooks/useDemandConversationSummaries.ts` |
| Edit | `src/components/demands/DemandDetailSheet.tsx` (lines 686-776 — conversation cards redesign) |
| Edit | `src/components/demands/LinkConversationDialog.tsx` (add "Vincular inteira" button) |
| Edit | `supabase/config.toml` (add summarize-conversation function entry) |

### No changes to
- `useUnlinkInteraction`, other hooks, `src/integrations/supabase/*`, `.env`

