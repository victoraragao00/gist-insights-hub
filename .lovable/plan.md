

## Plan: AgendaDetailPage — Dedicated page with markdown, collapsibles, inline editing

### Overview

Create a new `/agendas/:id` page that replaces the Sheet navigation pattern with a full page layout. Uses `react-markdown` for rich rendering, `Collapsible` for sections, and inline edit-on-click/save-on-blur for all fields. The existing `AgendaDetailSheet` is kept intact.

---

### 1. Install dependency

```bash
npm install react-markdown
```

### 2. Update `useMeetingAgenda` hook to join client name

In `src/hooks/useMeetingAgendas.ts`, change the `useMeetingAgenda` query to select `*, clients(name)` and return `MeetingAgendaWithClient` instead of `MeetingAgenda`. This gives the detail page access to the client name without an extra query.

### 3. New file: `src/pages/AgendaDetailPage.tsx`

Full-page layout with:

**Breadcrumb** — "Pautas > [title]" with click-to-navigate back

**Header Card** — Title (editable Input, save on blur), client name (read-only), date, location (editable Input), duration (editable number Input), satisfaction (SatisfactionPicker). AI badge if processed.

**Executive Summary Card** — Highlighted card (`bg-primary/5 border-primary/20`). Content rendered via `react-markdown` in read mode. Click toggles to Textarea for editing, save on blur. "Processar com IA" button if `ai_processed = false` and transcription exists.

**Collapsible Sections** (using `Collapsible` from shadcn):
- Objetivo — closed by default, 1-line preview when collapsed
- Notas de Contexto — closed by default
- Proximos Passos — closed by default
- Licoes de Casa — **open** by default
- Transcricao — closed by default

Each text section has two modes:
- **Read mode**: rendered with `react-markdown` + `prose prose-sm` classes. Click anywhere to enter edit mode.
- **Edit mode**: `Textarea` with the raw text. Save on blur, return to read mode.

**Homework section** — Same logic as current Sheet: split uMode/Cliente, "Adicionar item" inline, "Ticket" / "Ver ticket" buttons. Reuses `useMeetingHomework`, `useCreateHomeworkItem`, `useDeleteHomeworkItem`, `useConvertHomeworkToTicket`.

**Participants** — Compact inline list at the bottom (read-only display of names).

**Delete button** — AlertDialog at bottom, navigates to `/agendas` after deletion.

**State sync** — Single `useEffect` keyed on `agenda?.id`:
```typescript
useEffect(() => {
  if (!agenda) return;
  setTitle(agenda.title ?? "");
  setLocation(agenda.location ?? "");
  setDuration(agenda.duration_minutes ?? 60);
  setObjective(agenda.objective ?? "");
  setContextNotes(agenda.context_notes ?? "");
  setNextSteps(agenda.next_steps ?? "");
  setSummary(agenda.executive_summary ?? "");
  setTranscription(agenda.transcription ?? "");
}, [agenda?.id]);
```

### 4. Route in `src/App.tsx`

Add inside the authenticated layout routes:
```tsx
<Route path="/agendas/:id" element={<ErrorBoundary><AgendaDetailPage /></ErrorBoundary>} />
```

### 5. Update `src/pages/AgendasPage.tsx`

Change `handleOpen` to use `navigate(`/agendas/${agenda.id}`)` instead of opening the Sheet. Keep Sheet component rendered (but it won't be triggered from the list anymore).

---

### Files changed

| Action | File |
|--------|------|
| Install | `react-markdown` package |
| Edit | `src/hooks/useMeetingAgendas.ts` (join `clients(name)` in `useMeetingAgenda`) |
| New | `src/pages/AgendaDetailPage.tsx` |
| Edit | `src/App.tsx` (add route) |
| Edit | `src/pages/AgendasPage.tsx` (navigate instead of Sheet) |

### No changes to
- `AgendaDetailSheet.tsx` (kept as-is), migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

