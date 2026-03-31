

## Plan: Módulo RFI — Entidade própria 1:1 com Demanda

### Overview

Create RFI as a standalone entity with 1:1 relationship to demands, replacing the `rfi_url` field. Includes configurable statuses, auto-generated numbering (RFI-0001), client tab, demand integration, and settings management.

---

### 1. Database Migration

Single migration with the exact SQL provided in the prompt:
- `rfi_statuses` table with RLS (select for all authenticated, manage for admin via `is_admin()`)
- Seed 4 default statuses (Previsto, Orçada, Aceito, Recusada)
- `rfi_number_seq` sequence
- `rfis` table with `demand_id UNIQUE`, `rfi_seq_number bigint UNIQUE`, `rfi_number text UNIQUE`
- Trigger `trg_generate_rfi_number` using `generate_rfi_number()` function
- RLS policies scoped via `demands → client_id → user_accessible_client_ids(auth.uid())`
- INSERT policy also requires `created_by = auth.uid()`
- Indexes on `rfis(demand_id)`, `rfis(status_id)`, `demands(client_id)`
- Data migration: existing `rfi_url` values moved to new `rfis` records
- Drop `demands.rfi_url` column

---

### 2. New Hook — `src/hooks/useRfis.ts`

Queries:
- `useRfiByDemand(demandId)` — `.maybeSingle()`, queryKey `["rfi", demandId]`, staleTime 30s
- `useRfisByClient(clientId)` — fetches rfis joined with demands filtered by `client_id`, joined with `rfi_statuses(name, color)`, `user_profiles!assignee_id(full_name, email)`, `demands(title)`
- `useRfiStatuses()` — all active statuses ordered by position
- `useAllRfiStatuses()` — all statuses (for settings)

Mutations:
- `useCreateRfi()` — insert with `created_by: user.id`, invalidates `["rfi"]` and `["rfis"]`
- `useUpdateRfi()` — update single field on blur
- `useDeleteRfi()` — delete
- `useManageRfiStatuses()` — CRUD for admin settings (create, update, deactivate, reactivate, delete)

---

### 3. Edit `src/components/demands/DemandDetailSheet.tsx`

**Remove:** `rfiUrl`/`setRfiUrl` state, `normalizeUrl`, the RFI Input+ExternalLink block (lines 498-519)

**Add:** Import `useRfiByDemand`, `useCreateRfi` from `useRfis`. New RFI section:
- No RFI exists → Button "Criar RFI" (calls `useCreateRfi` with `demand_id`)
- RFI exists → Show `RFI-0001` as clickable text that opens `RfiDetailSheet`, plus status badge with color

---

### 4. Edit `src/components/demands/CreateDemandDialog.tsx`

- Remove `rfiUrl` state (line 55), the RFI URL input (lines 199-203), `rfi_url` from handleSubmit (line 73), and from resetForm (line 97)

---

### 5. Edit `src/hooks/useDemands.ts`

- Remove `rfi_url` from `useCreateDemand` input type (line 125)

---

### 6. New Component — `src/components/rfis/RfiDetailSheet.tsx`

Sheet lateral with editable fields (save on blur pattern, same as DemandDetailSheet):
- Número (readonly text)
- Assunto (Input)
- Status (Select with color badges, from `useRfiStatuses()`)
- Link (clickable + edit mode toggle)
- Descrição (Textarea)
- Responsável (Select from `user_profiles`)
- Data de vencimento (Input date)
- Valor/Orçamento (Input number)
- Link to parent Demand (clickable)
- Cliente name (readonly, via demand)

Uses `useUpdateRfi` for save-on-blur per field.

---

### 7. New Component — `src/components/rfis/ClientRfisTab.tsx`

Table with columns: Número, Assunto, Demanda, Status (badge), Responsável, Valor, Vencimento.
- Click row opens `RfiDetailSheet`
- Empty state: "Nenhuma RFI vinculada a este cliente"
- Uses `useRfisByClient(clientId)`

---

### 8. Edit `src/pages/ClientDetailPage.tsx`

Add tab between "Pautas" and "Interações":
```tsx
<TabsTrigger value="rfis">RFIs</TabsTrigger>
```
With `TabsContent` rendering `<ClientRfisTab clientId={client.id} />`.

---

### 9. New Component — `src/components/settings/RfiStatusSettingsTab.tsx`

Same pattern as `AreaSettingsTab`: table with name, color, position. Admin can create, edit, reorder, deactivate (soft-delete if RFIs are linked). Uses `useManageRfiStatuses()`.

---

### 10. Edit `src/pages/SettingsPage.tsx`

Add tab (admin only):
```tsx
{isAdmin && <TabsTrigger value="rfi-statuses">Status RFI</TabsTrigger>}
```
With `TabsContent` rendering `<RfiStatusSettingsTab />`.

---

### Files Summary

| Action | File |
|--------|------|
| Migration | New migration (2 tables + sequence + trigger + RLS + indexes + data migration + drop column) |
| New | `src/hooks/useRfis.ts` |
| New | `src/components/rfis/RfiDetailSheet.tsx` |
| New | `src/components/rfis/ClientRfisTab.tsx` |
| New | `src/components/settings/RfiStatusSettingsTab.tsx` |
| Edit | `src/components/demands/DemandDetailSheet.tsx` (replace rfi_url with RFI entity section) |
| Edit | `src/components/demands/CreateDemandDialog.tsx` (remove rfi_url field) |
| Edit | `src/hooks/useDemands.ts` (remove rfi_url from create input) |
| Edit | `src/pages/ClientDetailPage.tsx` (add RFIs tab) |
| Edit | `src/pages/SettingsPage.tsx` (add Status RFI tab) |

### No changes to
- Edge Functions, `src/integrations/supabase/*`, `.env`

