

## Sprint S1-C: Ajustes Pós-Validação Vitor

### Scope Assessment

This is a large sprint with 6 migrations, 4 new tables, ~10 new hooks, multiple UI changes across 5+ files, a storage bucket, notifications with realtime, and a notification bell component. I'll break it into clear implementation steps.

---

### Step 1 — Migrations (6 separate migrations)

1. **Deactivate demand types** — `UPDATE demand_types SET active = false WHERE name IN ('Comercial', 'Investigação Técnica')`  (via insert tool, not migration — it's DML)
2. **Create `demand_areas` table** — DDL + RLS + seed (seed via insert tool separately)
3. **Create `demand_assignees` table** — DDL + RLS
4. **Alter `demands`** — Add `area_id`, `assignee_id`, `rfi_url` columns
5. **Create `demand_attachments` table** — DDL + index + RLS
6. **Create `demand_notifications` table** — DDL + index + RLS
7. **Create storage bucket** `demand-attachments` + storage RLS policies

Notes:
- The CHECK constraint on `demand_attachments.type` is acceptable here (immutable values, not time-based)
- The CHECK on `demand_notifications.type` is also fine (immutable enum-like values)
- Storage RLS: the delete policy using `storage.foldername(name)[1]` assumes path starts with user_id — but the prompt specifies path as `demands/{demand_id}/{timestamp}_{filename}`. This policy won't work as written. Will adjust to allow authenticated users who created the attachment to delete (matching `demand_attachments.created_by` pattern instead).

---

### Step 2 — New Hooks

Create in `src/hooks/`:

| Hook | File |
|------|------|
| `useDemandAreas`, `useManageAreas` | `useDemandAreas.ts` |
| `useDemandAssignees`, `useManageAssignees` | `useDemandAssignees.ts` |
| `useDemandAttachments`, `useUploadAttachments`, `useAddLink`, `useDeleteAttachment` | `useDemandAttachments.ts` |
| `useDemandNotifications`, `useMarkNotificationRead` | `useDemandNotifications.ts` |

Update existing:
- `useDemands.ts` — add `area_id` to filters, add JOINs for `demand_areas(name,color)` and `demand_assignees(name)`, update `useCreateDemand` and `useUpdateDemand` payloads

---

### Step 3 — UI Changes

**`CreateDemandDialog.tsx`** — Add 3 new fields:
- Select "Área Responsável" (required, from `useDemandAreas`)
- Select "Responsável" (optional, from `useDemandAssignees`)
- Input "RFI Vinculado" (optional, URL)

**`DemandDetailSheet.tsx`** — Add:
- Area select, Assignee select (replaces text input), RFI input in meta grid
- New "Anexos e Links" section with file upload, link add, delete with AlertDialog
- Notification triggers inside mutations (create notifications for assignee/creator)

**`DemandCard.tsx`** — Add area badge below type badge

**`DemandsPage.tsx`** — Add "Área" filter combobox

**`SettingsPage.tsx`** — Add 2 new admin tabs: "Áreas" and "Responsáveis"
- Each with CRUD, inline editing, drag-and-drop reorder, soft delete with vinculation check, inactive section with reactivate

**`DashboardLayout.tsx`** — Add `NotificationBell` in header

**New component: `src/components/NotificationBell.tsx`**
- Bell icon with unread badge (max "9+")
- Popover with last 20 notifications
- Click → mark read + navigate to ticket
- "Marcar todas como lidas" button
- Realtime subscription on `demand_notifications`

---

### Step 4 — Storage Bucket

Create via migration:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('demand-attachments', 'demand-attachments', false);
```

Storage RLS policies for authenticated access (select, insert, delete).

---

### Files to Create (7)
- `src/hooks/useDemandAreas.ts`
- `src/hooks/useDemandAssignees.ts`
- `src/hooks/useDemandAttachments.ts`
- `src/hooks/useDemandNotifications.ts`
- `src/components/NotificationBell.tsx`
- `src/components/demands/AreaSettingsTab.tsx`
- `src/components/demands/AssigneeSettingsTab.tsx`

### Files to Modify (7)
- `src/hooks/useDemands.ts` — add area_id filter, JOINs, payload fields
- `src/components/demands/CreateDemandDialog.tsx` — 3 new fields
- `src/components/demands/DemandDetailSheet.tsx` — area/assignee/rfi + attachments section + notification triggers
- `src/components/demands/DemandCard.tsx` — area badge
- `src/pages/DemandsPage.tsx` — area filter combobox
- `src/pages/SettingsPage.tsx` — 2 new tabs (Áreas, Responsáveis)
- `src/components/DashboardLayout.tsx` — NotificationBell in header

### Technical Divergence to Report

**Storage delete policy:** The prompt specifies path `demands/{demand_id}/{timestamp}_{filename}` but the delete RLS uses `auth.uid()::text = (storage.foldername(name))[1]` which would check against `demands` not the user's ID. Will use a simpler policy: allow delete for authenticated users on the bucket, with application-level check via `demand_attachments.created_by`.

