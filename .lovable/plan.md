## Workspace Switcher (CX | TECH)

Adds a top-of-sidebar workspace toggle that swaps the entire navigation, plus aging badges on Kanban cards and TECH defaults for the demands page.

### Files

**New**
- `src/hooks/useUserProfile.ts` — reads `user_profiles` (id, default_workspace, global_role, active) for current user. Separate from `useUserRole` (which only selects `global_role, active`) to expose `default_workspace` cleanly. `staleTime: 5min`, `queryKey: ["user-profile", user?.id]`.
- `src/hooks/useWorkspace.ts` — returns `{ activeWorkspace, setWorkspace, defaultWorkspace }`. Persists in `sessionStorage` under `cx_hub_active_workspace`. Initializes from session; on profile load, applies `default_workspace` if no session entry. `'both'` falls back to `'cx'`.
- `src/components/layout/WorkspaceSwitcher.tsx` — segmented toggle (Users icon / Code2 icon) using design system tokens (`bg-muted/60`, `bg-background`). Hidden when sidebar is collapsed (icon-only mode).
- `src/lib/getAgingStyle.ts` — `getAgingDays(demand)` and `getAgingStyle(days)` per spec. Returns `null` for `<3d`; yellow `3–6d`; orange `7–13d`; red `≥14d`.

**Modified**
- `src/components/AppSidebar.tsx`
  - Import `useWorkspace`, `WorkspaceSwitcher`, plus `Code2`, `FolderKanban`, `Calendar` from lucide.
  - Render `<WorkspaceSwitcher>` between `SidebarHeader` and `SidebarContent` (only when `!collapsed`).
  - Replace static `modules` with `cxItems` / `techItems` arrays and pick by `activeWorkspace`.
  - TECH items: Kanban (`/demands`), Projetos (`/projects`), Dashboard TECH (`/tech/dashboard`), Pautas Internas (`/agendas?type=internal`).
  - Group label switches to "TECH" / "Módulos" accordingly.
- `src/pages/DemandsPage.tsx`
  - Import `useWorkspace`. When `activeWorkspace === 'tech'`, default `filterClient` stays empty (already shows all) — confirmed current behavior matches; no functional change beyond reading the workspace for future label tweaks. Will leave the existing client filter visible (still useful), but not pre-select. (No-op verified — keep change minimal: just consume hook to ensure remount key on workspace change via `key={activeWorkspace}` on the page root, so filters reset between workspaces.)
- `src/components/demands/DemandCard.tsx`
  - Import `getAgingDays`, `getAgingStyle`. Render aging Badge in the badges row next to hours badge.

### Notes / decisions

- `useWorkspace` is intentionally split from `useUserRole` so `useUserRole`'s shape stays untouched (avoids invalidating its cached consumers).
- Sidebar switcher hidden in collapsed state (icon mode) — keeps the icon strip clean; user can expand to switch.
- `sessionStorage` only (per spec); cleared automatically on browser/tab close.
- TECH "Pautas Internas" link uses query string `?type=internal` — assumes `AgendasPage` will read it later (out of scope here; link works regardless).
- No DB or migration changes.
- No `localStorage`, no `use-toast`, no unused imports. `staleTime` set on the new profile query.

### Verification

Matches the 11-point checklist in the prompt: switcher visible, sidebar swaps, session persistence, aging badge thresholds, TECH Kanban defaults to all clients.
