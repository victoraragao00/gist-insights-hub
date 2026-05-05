## Projects Module — Frontend (Sprint 2-B)

Builds the full Projects UI on top of the schema from 1-B and the workspace switcher from 2-A. No DB changes.

### New files

**Hooks**
- `src/hooks/useProjects.ts` — all queries + mutations:
  - `useProjects({ workspace = "tech" })` — list with `user_profiles!owner_id(id, full_name, email)` + `clients(id, name)`. `staleTime: 5min`. Key: `["projects", user?.id, workspace]`.
  - `useProject(id)` — single project + nested members. `staleTime: 30s`.
  - `useProjectStats(id)` — `supabase.rpc("get_project_stats", { p_project_id })`. `staleTime: 30s`.
  - `useProjectMembers(projectId)` — `project_members` joined with `user_profiles`. `staleTime: 5min`.
  - `useProjectDemands(projectId)` — demands joined with `demand_types`, `ticket_columns`, `user_profiles!assignee_id`. `staleTime: 30s`.
  - `useUnassignedDemands(query)` — demands with `project_id IS NULL` for the link dialog. `staleTime: 30s`.
  - Mutations: `useCreateProject`, `useUpdateProject`, `useCancelProject` (RPC), `useAddProjectMember`, `useRemoveProjectMember`, `useLinkDemandToProject`, `useUnlinkDemandFromProject`. All destructure `{ data, error }`, `sonner` toasts, programmatic invalidations.

**Helpers / shared UI**
- `src/lib/projectStatus.ts` — `statusConfig` map (planning/active/completed/cancelled) and `StatusBadge` styling helpers.
- `src/components/projects/StatusBadge.tsx`
- `src/components/projects/MemberAvatar.tsx` — initials avatar (sm/md sizes), uses `bg-primary/10 text-primary`.
- `src/components/projects/ProjectCard.tsx` — list card with progress bar, squad avatars, deadline, overdue alert; consumes `useProjectStats(project.id)` + `useProjectMembers(project.id)`.
- `src/components/projects/CreateProjectDialog.tsx` — title, description, client (Combobox of clients), due_date (date input), workspace defaults to `'tech'`. Uses `useCreateProject`.
- `src/components/projects/LinkDemandDialog.tsx` — search + list of unassigned demands; click links via `useLinkDemandToProject`.
- `src/components/projects/ProjectSelect.tsx` — compact combobox of `useProjects()` + "Nenhum" option for the demand sidebar.
- `src/components/projects/UserSelect.tsx` — local user picker that excludes already-listed user_ids.
- `src/components/projects/tabs/ProjectDemandsTab.tsx`
- `src/components/projects/tabs/ProjectSquadTab.tsx`
- `src/components/projects/tabs/ProjectActivityTab.tsx` — minimal: list of derived events (created, members added, demands linked, cancelled). For v1, derive from project + members `added_at` + demands `created_at`. Keep simple.

**Pages**
- `src/pages/ProjectsPage.tsx` — header (title, count, "Novo projeto"), client-side filter chips (Todos/Planejamento/Ativo/Concluído — filters using each card's stats), responsive grid. Workspace-scoped to `'tech'`.
- `src/pages/ProjectDetailPage.tsx` — header with breadcrumb, inline-editable title (uses `useUpdateProject`), `StatusBadge`, owner pill, full-width progress bar, Tabs (Demandas/Squad/Atividade), right sidebar (280px) with details, total hours, and Cancel action (AlertDialog → `useCancelProject`). Owner-only actions guarded via `project.owner_id === user?.id`.

### Modified files

- `src/App.tsx` — add `<Route path="/projects" element={<ErrorBoundary><ProjectsPage/></ErrorBoundary>} />` and `/projects/:id` inside the protected `DashboardLayout` block. Lazy import not required.
- `src/components/demands/detail/DemandSidebar.tsx` — add a "Projeto" row (above or near Coluna) with `<ProjectSelect>` driven by `useLinkDemandToProject` / `useUnlinkDemandFromProject`. Shows current `demand.project_id`.

### Notes

- Status is always read from `get_project_stats` — never inferred client-side except for filter chips, which still read from each card's `useProjectStats`.
- `useCancelProject` calls `supabase.rpc("cancel_project", { p_project_id, p_reason })`. Never DELETE.
- `useAddProjectMember` uses `.upsert(..., { onConflict: "project_id,user_id", ignoreDuplicates: true })` to honour ON CONFLICT DO NOTHING.
- All queries include `user?.id` in the key per project memory rule.
- All writes go through `useMutation`; `{ data, error }` destructured; `sonner` for feedback.
- TECH workspace already routes `/projects` from sidebar (Sprint 2-A) — this implements the destination.
- No edits to `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, or any Supabase-generated file.

### Verification

Maps 1:1 to the 13-point checklist in the prompt: route loads, create flows, link/unlink, member management, status badge transitions, owner-only cancel, demand sidebar field.
