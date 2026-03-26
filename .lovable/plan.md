

## Plan: SA-4 — Agenda Settings Tab + End-to-End Verification

### What exists
- SA-1 (tables, RLS, seed): Done
- SA-2 (CRUD, routes, sidebar): Done
- SA-3 (Edge Function, AI processing, homework-to-ticket): Done
- `useAgendaFieldConfig.ts` hook: Done (reads from `app_settings`)
- `CreateAgendaDialog` already uses `fieldConfig` for visibility/required checks

### What's missing
1. **SA-4: Admin settings tab** — No UI to edit `agenda_required_fields` in `app_settings`

### Implementation

#### 1. New component: `src/components/settings/AgendaSettingsTab.tsx`
- Card with title "Pautas de Reuniao"
- Table with rows for each field (title, meeting_date, client_id, objective, context_notes, satisfaction_score, next_steps, transcription, location)
- Each row: field label + RadioGroup with 3 options (obrigatorio / opcional / oculto)
- Field labels read from a const map (never hardcoded inline)
- Reads current config via `useAgendaFieldConfig()`
- Saves via `useMutation` → `supabase.from("app_settings").update(...)` where key = `agenda_required_fields`
- Only admin can access (parent already guards with `isAdmin`)
- Uses `sonner` toast on success/error

#### 2. Edit `src/pages/SettingsPage.tsx`
- Import `AgendaSettingsTab`
- Add tab trigger: `{isAdmin && <TabsTrigger value="agendas">Pautas</TabsTrigger>}` (after "areas")
- Add tab content: `{isAdmin && <TabsContent value="agendas"><AgendaSettingsTab /></TabsContent>}`

#### 3. Hardcoded audit
- `CreateAgendaDialog`: Already uses `fieldConfig` — no hardcoded values
- `AgendaDetailSheet`: Satisfaction labels "uMode"/"Cliente" come from DB `responsible_label` — not hardcoded
- `SatisfactionPicker`: Emoji picker 1-5 — inherent UI, not a config concern
- `AgendasPage`: Filter uses `clients` from context — dynamic
- Edge Function: Gemini prompt has fixed structure (expected — it's an AI instruction, not user-facing config)

#### 4. End-to-end flow verification (post-implementation)
- Test creating a pauta with all field visibility combos
- Test AI processing with a sample transcription
- Test homework item creation (manual + AI)
- Test converting homework to ticket
- Test admin settings tab saving

### Files changed
- **New:** `src/components/settings/AgendaSettingsTab.tsx`
- **Edit:** `src/pages/SettingsPage.tsx` (2 lines: tab trigger + tab content)

