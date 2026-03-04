

# CX HUB — Full Recovery Plan

## Scope

18 file operations: 7 CREATE, 7 MODIFY, 2 DELETE, 2 config changes.

---

## PART 1: Auth Layer (4 new files)

### `src/context/AuthContext.tsx`
- React context with `user`, `session`, `loading`, `signOut()`
- `onAuthStateChange` listener set up BEFORE `getSession()` call
- `useAuth()` hook throws if used outside `AuthProvider`
- Types from `@supabase/supabase-js` (`User`, `Session`)

### `src/components/ProtectedRoute.tsx`
- If `loading`: centered `Loader2` spinner
- If `!user`: `<Navigate to="/login" replace />`
- Otherwise: `<Outlet />`

### `src/pages/LoginPage.tsx`
- Email + password form with React Hook Form + Zod
- Calls `supabase.auth.signInWithPassword`
- Uses `sonner` for errors, navigates to `/` on success
- Link to `/signup`

### `src/pages/SignupPage.tsx`
- Email + password + confirm password with Zod validation
- Calls `supabase.auth.signUp` (no auto-confirm)
- Success message: "Verifique seu email"
- Link to `/login`

### `src/components/ErrorBoundary.tsx`
- Class component, `getDerivedStateFromError`
- Fallback: centered card "Algo deu errado" + reload button

---

## PART 2: Client Context (1 new file)

### `src/context/ClientContext.tsx`
- Queries `clients` table with `.limit(100)`, key `["clients", user?.id]`
- Exposes: `clients`, `selectedClient`, `setSelectedClient`, `loading`
- Exposes: `importing`, `importProgress`, `handleImportHistory` (paginated loop calling `ingest-gist-historical`)
- `useClient()` hook throws if outside provider

---

## PART 3: App.tsx Routing (modify)

### `src/App.tsx`
- Remove shadcn `<Toaster />`, keep only sonner
- Remove `/integrations`, `/indicators`, `/insights` routes
- Add `/login`, `/signup` (public), `/interactions` (protected)
- Structure: `AuthProvider` > `Routes` > public routes + `ProtectedRoute` outlet > `ClientProvider` > `DashboardLayout` (using `<Outlet />`) > page routes
- Every page route wrapped in `<ErrorBoundary>`

### `src/components/DashboardLayout.tsx` (modify)
- Change from `children` prop to rendering `<Outlet />` so it works as a layout route
- Keep `SidebarProvider`, `AppSidebar`, header

---

## PART 4: Three Edge Functions (3 new files)

All set `verify_jwt = false` in `supabase/config.toml`. All include CORS headers.

### `supabase/functions/gist-discover/index.ts`
- Paginates all Gist contacts (`GET /contacts?page=N&per_page=60`)
- Fetches all teammates (`GET /teammates`)
- Groups contacts by email domain
- For each domain, queries `clients` table for name/slug similarity (case-insensitive `ILIKE` with wildcard from domain parts)
- Returns `DiscoveryPayload` with `suggested_client_id` where match found
- Uses `GIST_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`

### `supabase/functions/gist-confirm-mapping/index.ts`
- Receives mappings array + teammates array
- Creates new clients where `mapping_type === "new"`
- Upserts participants with `side='client'`, identifiers lookup via `.filter("identifiers", "cs", JSON.stringify(...))`
- Upserts teammates as `side='umode'`, `client_id=null`
- Creates `channel_bindings` for each mapped client
- Returns counts

### `supabase/functions/ingest-gist-historical/index.ts`
- Input: `{ page?: number }`, processes 20 conversations per call
- Loads `channel_bindings` where `channel='gist'` and `participants` with gist identifiers
- Fetches conversations page, then all messages per conversation
- Maps to `interactions` table, `ON CONFLICT (channel, external_id) DO NOTHING`
- 100ms delay between conversations, retry on 429 with 2s wait
- Returns `IngestionResult` with `has_more` + `next_page`

### `supabase/config.toml` update
Add entries for three new functions with `verify_jwt = false`.

---

## PART 5: Quality Fixes (modify 5 files, delete 2)

### DELETE `src/pages/Integrations.tsx`
Orphan page using wrong toast lib. Superseded by SettingsPage.

### DELETE `src/components/GistTestPanel.tsx`
Debug tool, not product code.

### `src/hooks/useGistKPIs.ts`
- Replace `(t: any)` with typed interface `GistTeammateResponse`
- Type all intermediate API response shapes
- No query key change needed (this is global, not user-scoped — it calls Gist API directly)

### `src/pages/ClientsPage.tsx`
- Remove `DashboardLayout` wrapper (now handled by layout route)
- Add `.limit(100)` to clients query, `.limit(200)` to participants query
- Query keys: `["clients", user?.id]`, `["participants", selectedClientId, user?.id]`, `["channel_bindings", selectedClientId, user?.id]`
- Get `user` from `useAuth()`

### `src/pages/SettingsPage.tsx`
- Remove `DashboardLayout` wrapper
- Add `.limit(100)` to queries
- Query keys include `user?.id`
- Get `user` from `useAuth()`

### `src/components/GistContactWizard.tsx`
- Add `.limit(100)` to clients query
- No other changes needed (already uses sonner, typed interfaces)

### `src/components/AppSidebar.tsx`
- Remove `/integrations`, `/indicators`, `/insights` nav items
- Add client selector dropdown below logo using `useClient()` context
- Keep: Dashboard, Clientes, Interações, Auditorias, Configurações
- Show `selectedClient?.name` in a `Select` component

### `src/pages/Index.tsx`
- Remove `DashboardLayout` wrapper
- Update "Integrações" button to navigate to `/settings`
- Remove `/indicators` navigation button

---

## PART 6: InteractionsPage (1 new file)

### `src/pages/InteractionsPage.tsx`
- Title: "Interações" with subtitle showing selected client name
- Queries `interactions` count for `selectedClient?.id`
- Query key: `["interactions_count", selectedClient?.id, user?.id]`
- Shows count in a KPICard
- Empty state placeholder for future classification UI

---

## File Summary

| Action | File |
|--------|------|
| CREATE | `src/context/AuthContext.tsx` |
| CREATE | `src/context/ClientContext.tsx` |
| CREATE | `src/components/ProtectedRoute.tsx` |
| CREATE | `src/components/ErrorBoundary.tsx` |
| CREATE | `src/pages/LoginPage.tsx` |
| CREATE | `src/pages/SignupPage.tsx` |
| CREATE | `src/pages/InteractionsPage.tsx` |
| CREATE | `supabase/functions/gist-discover/index.ts` |
| CREATE | `supabase/functions/gist-confirm-mapping/index.ts` |
| CREATE | `supabase/functions/ingest-gist-historical/index.ts` |
| MODIFY | `src/App.tsx` |
| MODIFY | `src/components/DashboardLayout.tsx` |
| MODIFY | `src/components/AppSidebar.tsx` |
| MODIFY | `src/hooks/useGistKPIs.ts` |
| MODIFY | `src/pages/ClientsPage.tsx` |
| MODIFY | `src/pages/SettingsPage.tsx` |
| MODIFY | `src/components/GistContactWizard.tsx` |
| MODIFY | `src/pages/Index.tsx` |
| MODIFY | `supabase/config.toml` |
| DELETE | `src/pages/Integrations.tsx` |
| DELETE | `src/components/GistTestPanel.tsx` |

**Not touched:** `gist-proxy/index.ts`, `src/components/ui/*`, `KPICard.tsx`, `NavLink.tsx`, `client.ts`, `types.ts`, database schema.

