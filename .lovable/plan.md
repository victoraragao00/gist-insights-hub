

## Plan: Fix summarize-conversation — Switch to Lovable AI Gateway

### Root Cause
The direct Gemini API endpoint rejects both `gemini-1.5-flash` and `gemini-2.0-flash` with 404 errors. These models are deprecated on the `v1beta` endpoint.

### Fix — `supabase/functions/summarize-conversation/index.ts`

Replace the direct Gemini API call (lines ~105-125) with a call to the Lovable AI Gateway:

- **URL**: `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Auth**: `Bearer ${LOVABLE_API_KEY}` (already available as a secret)
- **Model**: `google/gemini-2.5-flash`
- **Format**: OpenAI-compatible chat completions (system + user messages)

Changes:
1. Replace `GEMINI_API_KEY` check with `LOVABLE_API_KEY` check
2. Replace the `fetch` call to `generativelanguage.googleapis.com` with a call to the gateway
3. Parse response from OpenAI-compatible format (`choices[0].message.content`) instead of Gemini format (`candidates[0].content.parts[0].text`)

Everything else (auth, upsert, CORS, HTML stripping) stays the same.

### Files changed
| Action | File |
|--------|------|
| Edit | `supabase/functions/summarize-conversation/index.ts` (swap API call) |

### No changes to
- Frontend hooks, UI components, migrations, RLS, `src/integrations/supabase/*`, `.env`

