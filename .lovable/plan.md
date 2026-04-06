

## Plan: Fix AgendaDetailSheet — Sync all editable fields

### Root Cause

Lines 62-67 use a manual sync pattern (`prevAgendaId` via useState) that only syncs `transcriptionDraft` and `summaryDraft`. The fields `objective`, `context_notes`, and `next_steps` are not synced at all — they are rendered directly from `agenda.*` as read-only text, but wrapped in `{agenda.objective && ...}` guards. Since the query data arrives asynchronously, these fields may be undefined on first render and never re-display.

Additionally, these fields should be editable (Textarea with save-on-blur), not read-only paragraphs.

### Fix

**File: `src/components/agendas/AgendaDetailSheet.tsx`**

1. Replace the manual sync pattern (lines 62-67) with a proper `useEffect` that syncs ALL draft fields when agenda data changes:

```typescript
useEffect(() => {
  if (!agenda) return;
  setTranscriptionDraft(agenda.transcription ?? "");
  setSummaryDraft(agenda.executive_summary ?? "");
  setObjective(agenda.objective ?? "");
  setContextNotes(agenda.context_notes ?? "");
  setNextSteps(agenda.next_steps ?? "");
}, [agenda?.id, agenda?.transcription, agenda?.executive_summary, 
    agenda?.objective, agenda?.context_notes, agenda?.next_steps]);
```

2. Add state variables for `objective`, `contextNotes`, `nextSteps` (currently missing)

3. Convert the read-only `objective` display (line 185-189) to an editable Textarea with save-on-blur

4. Add editable sections for `context_notes` and `next_steps` (currently not shown at all in the detail view)

5. Remove the old `prevAgendaId` manual sync (lines 62-67)

### Files changed

| Action | File |
|--------|------|
| Edit | `src/components/agendas/AgendaDetailSheet.tsx` (add state + useEffect sync + editable fields) |

### No changes to
- Hooks, mutations, migrations, RLS, `src/integrations/supabase/*`, `.env`

