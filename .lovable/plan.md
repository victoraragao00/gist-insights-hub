

## Plan: Fix "Processar com IA" button visibility + enrich prompt with context fields

### Problem
1. The button only appears when `transcription.trim()` is truthy — if transcription is empty, no button shows
2. The Edge Function prompt only includes the transcription text, missing `objective`, `context_notes`, and `next_steps` which would improve AI output quality

### Changes

#### 1. `src/pages/AgendaDetailPage.tsx`
- Move the "Processar com IA" button to the Transcription collapsible section (more intuitive — user writes/pastes transcription there, then clicks process)
- Also keep a secondary button in the Executive Summary card for reprocessing
- Update `handleProcessAI` to pass `objective`, `contextNotes`, and `nextSteps` alongside `transcription`
- Relax the condition: button visible when transcription has content (keep this check since AI needs transcription to process)

#### 2. `src/hooks/useMeetingAI.ts`
- Expand the mutation input to accept optional `objective`, `context_notes`, `next_steps` fields
- Pass them in the body to the Edge Function

#### 3. `supabase/functions/process-meeting-transcription/index.ts`
- Accept optional `objective`, `context_notes`, `next_steps` from request body
- Append them as context sections in the Gemini prompt before the transcription:
```
CONTEXTO DA REUNIÃO:
Objetivo: {objective}
Notas de Contexto: {context_notes}
Próximos Passos Previstos: {next_steps}

TRANSCRIÇÃO:
{transcription}
```
- Only include non-empty fields in the context block
- Use Lovable AI Gateway instead of direct Gemini API (per project standards, memory `tech/ai/gemini-implementation-details`)

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/AgendaDetailPage.tsx` (button placement + pass context fields) |
| Edit | `src/hooks/useMeetingAI.ts` (accept context fields in mutation) |
| Edit | `supabase/functions/process-meeting-transcription/index.ts` (enrich prompt + use AI Gateway) |

### No changes to
- Migrations, RLS, `src/integrations/supabase/*`, `.env`

