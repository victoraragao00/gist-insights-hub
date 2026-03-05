

## CX Hub — Rebuild Clients UI

This is a large UI rebuild: replacing `ClientsPage.tsx` entirely, creating a new `ClientDetailPage.tsx` with 6 tabs, adding a route, and conditionally hiding the sidebar client selector.

### Files to modify/create

**1. `src/pages/ClientsPage.tsx`** — Full rewrite
- Remove all existing code (dialogs, participant management, scope editing, wizard)
- New layout: header + "+ Novo Cliente" button (toast "Em breve") + full-width table
- Query clients with channel_bindings joined, plus interactions (30d) for stats
- Compute client-side: `total_30d`, `dominant_tone`, `health_pct`, `last_contact` per client
- Table columns: Cliente (name+slug), Canais (emoji badges), Interações 30d, Tom predominante (colored badge), Saúde (thermometer bar 64px), Último contato (formatted), Actions (dropdown)
- Row click → `navigate(/clients/${slug})`
- Loading skeleton, empty state, sort by last interaction DESC

**2. `src/pages/ClientDetailPage.tsx`** — New file (~800 lines)
- Fetch client by slug from URL params, redirect if not found
- Breadcrumb → Header (name, badges, subtitle) → Tab bar with 6 tabs + 1 disabled
- **Tab 1 — Visão Geral**: 4 KPI cards, 14-day volume bar chart (inline divs), tone distribution segmented bar, recent non-ok interactions table (last 5)
- **Tab 2 — Participantes**: Two sections (client side / uMode side), tables with name/email/role/channels, disabled action buttons
- **Tab 3 — Canais**: Connected bindings list with icons + badges, disconnected channels grayed out, "Conectar canal" button (toast)
- **Tab 4 — Documentos**: Grid from `metadata.documents`, upload zone placeholder (toast "Em breve"), empty state
- **Tab 5 — Regras de Negócio**: Escopo (editable textarea saving to metadata.scope), monitored themes as pills, governance rules list with toggles
- **Tab 6 — Configurações**: SLA card (editable fields from metadata.sla), audit_rules toggles for this client, danger zone with deactivate button + confirmation dialog
- **Tasks tab**: Grayed out, cursor-not-allowed, toast on click

**3. `src/App.tsx`** — Add route
- Import `ClientDetailPage`
- Add `<Route path="/clients/:slug" element={<ErrorBoundary><ClientDetailPage /></ErrorBoundary>} />` inside the protected/layout group

**4. `src/components/AppSidebar.tsx`** — Hide client selector on detail page
- Check `location.pathname` starts with `/clients/` and has a slug segment
- Conditionally hide the `<Select>` client selector on that route

### Data queries approach

- **ClientsPage**: Two queries — clients with channel_bindings (joined), and interactions (30d) for all clients. Stats computed client-side by grouping.
- **ClientDetailPage**: Client by slug, participants, channel_bindings, interactions (30d) for that client, audit_rules for that client. Each as separate `useQuery`.

### Styling
- Purple primary `#7c3aed`, white cards with `border border-zinc-200 rounded-xl`
- Tone badges: green/yellow/orange/red with `bg-{color}-100 text-{color}-700`
- Thermometer: thin bar (h-2, w-16) with color based on health percentage
- Tab content padding via Tailwind utilities

### Key types
- `ClientMetadata` interface as specified in the prompt
- Reuse existing `Client` type pattern from `ClientContext`

### Not touching
- Edge functions, ClientContext, AuthContext, other pages

