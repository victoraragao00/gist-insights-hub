

## Plan: Implementar abas Documentos e Regras de Negocio no ClientDetailPage

### Overview

Criar duas tabelas (`client_documents`, `client_rules`), bucket de storage, hooks dedicados e dois componentes de aba que substituem os placeholders atuais baseados em `metadata`.

---

### 1. Database Migration

Single migration with all SQL from the prompt:
- `client_documents` table with RLS (select/insert/update/delete via `user_accessible_client_ids`)
- `client_rules` table with RLS (same pattern)
- `updated_at` triggers for both tables
- Storage bucket `client-documents` (private)
- Storage RLS policies for authenticated users
- Indexes on `client_id`

**Note:** The CHECK constraint on `category` is immutable and safe here (static list of values, no time-based logic).

The `created_by REFERENCES auth.users(id)` will be replaced with just `created_by UUID` (no FK to auth schema per project rules). The `assignee_id` FK to `user_profiles(id)` is fine.

---

### 2. Hooks

**`src/hooks/useClientDocuments.ts`**
- `useClientDocuments(clientId)` — query with join `user_profiles!assignee_id(full_name, email)`, queryKey `["client_documents", clientId]`, staleTime 60s
- `useCreateDocument()` — mutation, invalidates query
- `useUpdateDocument()` — mutation for inline edit (title, description, assignee, category)
- `useDeleteDocument()` — mutation
- `useUploadDocument(clientId)` — uploads to `client-documents` bucket, then inserts record

**`src/hooks/useClientRules.ts`**
- `useClientRules(clientId)` — query, queryKey `["client_rules", clientId]`, staleTime 60s
- `useCreateClientRule()` — mutation
- `useUpdateClientRule()` — mutation (toggle active, edit description)
- `useDeleteClientRule()` — mutation

---

### 3. Components

**`src/components/clients/ClientDocumentsTab.tsx`**
- Header with "Adicionar link" and "Upload arquivo" buttons
- Document cards with: category icon, editable title (on blur), category badge, description, assignee select, link/download, delete with AlertDialog
- Dialog for adding link (Title, Category, Description, URL, Assignee)
- Hidden file input for upload
- Empty state

**`src/components/clients/ClientRulesTab.tsx`**
- Section 1: "Regras Globais" — readonly list of `audit_rules` (existing query from the page, filtered for global + this client)
- Section 2: "Regras deste Cliente" — CRUD list from `client_rules` table with Switch toggle, editable description, delete with AlertDialog, "Nova Regra" dialog
- Empty states for both sections

---

### 4. Integration in ClientDetailPage

- Import `ClientDocumentsTab` and `ClientRulesTab`
- Replace current placeholder content in `TabsContent value="documents"` (lines 1038-1075) with `<ClientDocumentsTab clientId={client.id} />`
- Replace current placeholder content in `TabsContent value="rules"` (lines 1077-1117) with `<ClientRulesTab clientId={client.id} />`
- Update tab trigger for documents to remove `({documents.length})` count from metadata (will be handled internally by the component)
- Remove unused `documents`, `governanceRules`, `monitoredThemes` variables and related metadata types

---

### Files changed

| Action | File |
|--------|------|
| Migration | Create `client_documents`, `client_rules` tables + storage bucket + RLS |
| New | `src/hooks/useClientDocuments.ts` |
| New | `src/hooks/useClientRules.ts` |
| New | `src/components/clients/ClientDocumentsTab.tsx` |
| New | `src/components/clients/ClientRulesTab.tsx` |
| Edit | `src/pages/ClientDetailPage.tsx` (replace placeholder tabs, clean up metadata refs) |

### No changes to
- Edge Functions, `src/integrations/supabase/*`, `.env`, other tabs

