## Goal
Add per-column collapse/expand to the Kanban (CX flat) and Swimlane (TECH) views. Default state collapses "finished" columns (`triggers_finished_at = true`); state persists in `sessionStorage`.

## New file: `src/hooks/useCollapsedColumns.ts`
- Accepts `columns: Tables<"ticket_columns">[]`.
- State map `Record<string, boolean>` initialized per column from `sessionStorage.getItem('kanban_col_collapsed_' + id)`; if absent, defaults to `!!col.triggers_finished_at`.
- Returns `{ isCollapsed(id), toggle(id) }`. `toggle` writes the new value to `sessionStorage`.
- Reconcile when `columns` array changes (new columns get default seed) using a `useEffect` that merges missing IDs without overwriting user choices.

## Edit: `src/components/demands/KanbanColumn.tsx` (CX flat)
- Remove the local `useState` for collapse; receive `isCollapsed: boolean` and `onToggleCollapse: (id) => void` as props (lifted to parent).
- Outer wrapper width transitions:
  - Expanded: `w-64 min-w-64 max-w-72`.
  - Collapsed: `w-12 min-w-[48px]` with vertical layout — count badge on top + column name in `[writing-mode:vertical-rl] rotate-180`.
- Header (expanded mode) becomes clickable to toggle; chevron rotates `-rotate-90` when collapsed.
- Cards container wrapped in `overflow-hidden transition-all duration-200`; hidden via `max-h-0` when collapsed (drop zone + Plus button hidden too).
- Keep dnd-kit `useDroppable` active so drag-over a collapsed column is a no-op visually but doesn't break.

## Edit: `src/pages/DemandsPage.tsx` (CX parent)
- Call `const { isCollapsed, toggle } = useCollapsedColumns(columns);`.
- Pass `isCollapsed={isCollapsed(col.id)}` and `onToggleCollapse={toggle}` to each `<KanbanColumn>`.

## Edit: `src/components/demands/TechSwimlanePage.tsx`
- Use `useCollapsedColumns(columns)`.
- Compute `gridTemplate` dynamically: `160px ` + columns mapped to `48px` if collapsed else `minmax(220px, 1fr)`.
- Header row: each column header is clickable (`onClick={() => toggle(col.id)}`); when collapsed show only count + chevron (or vertical name); chevron rotates.
- `SwimlaneCell`: add `isCollapsed` prop; when true render compact placeholder `<div className="min-h-20 rounded-md bg-muted/10 w-full" />` with no cards (still mount `useDroppable`? — skip droppable when collapsed to avoid accidental drops).
- Lane label column unchanged.

## Behavior summary
| State | Default |
|---|---|
| Column with `triggers_finished_at=true` | collapsed |
| Other columns | expanded |
| User toggle | persisted to `sessionStorage` per column id |
| New session | resets to defaults |

## Quality
- m11: prune unused imports (e.g. drop `useState`/`ChevronRight` from `KanbanColumn` if no longer needed; keep `ChevronDown` only).
- No new libs. Smooth transitions via existing Tailwind utilities (`transition-all duration-200`).
- No DB / edge-function changes; no `localStorage`; no `use-toast`.
