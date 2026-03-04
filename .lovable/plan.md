

# CX Hub — Steps 1, 2, 3 Implementation Plan

## Step 1: Authentication

### Create files:

**`src/context/AuthContext.tsx`**
- React context with `user`, `session`, `loading`, `signOut`
- Sets up `onAuthStateChange` BEFORE `getSession()` 
- Typed interfaces for context value

**`src/components/ProtectedRoute.tsx`**
- Shows spinner while `loading`
- Redirects to `/login` if no user
- Renders `children` otherwise

**`src/components/ErrorBoundary.tsx`**
- Class component with `getDerivedStateFromError`
- Fallback UI with retry button

**`src/pages/LoginPage.tsx`**
- Email + password form using sonner for toasts
- Link to `/signup`
- Calls `supabase.auth.signInWithPassword`
- Redirects to `/` on success

**`src/pages/SignupPage.tsx`**
- Email + password + confirm password
- Link to `/login`
- Calls `supabase.auth.signUp`
- Shows "check your email" message

### Modify files:

**`src/App.tsx`**
- Wrap in `<AuthProvider>`
- Remove `@/components/ui/toaster` import and `<Toaster />` (keep only sonner)
- Add `/login` and `/signup` routes (public)
- Wrap all other routes in `<ProtectedRoute>` + `<ErrorBoundary>`

---

## Step 2: Database Migration

Single migration that:
1. Drops old tables: `alert_logs`, `alert_rules`, `kpi_indicators`, `data_sources`, `integrations` (CASCADE)
2. Drops old enums: `metric_type`, `chart_type`, `condition_type`, `platform_type`, `auth_type`
3. Creates new enums: `channel_type`, `interaction_type`, `tone_severity`, `alert_channel`
4. Creates 7 tables: `clients`, `channel_bindings`, `participants`, `interactions`, `audit_rules`, `audit_alerts`, `user_client_access`
5. Creates indexes for dedup, performance, and full-text search
6. Enables RLS on all tables with appropriate policies
7. Inserts seed data: `By NV` client

The `user_client_access` seed row will need to be inserted manually after first login (user UUID unknown until then). Will add a note about this.

---

## Step 3: Sidebar + Routes + ClientContext

### Create files:

**`src/context/ClientContext.tsx`**
- Fetches clients from `clients` table filtered by `user_client_access`
- Query key: `["clients", user.id]`
- Exposes: `clients`, `selectedClient`, `setSelectedClient`, `loading`
- staleTime: 5 minutes

**`src/pages/InteractionsPage.tsx`** — placeholder with title "Interações"

**`src/pages/ClientsPage.tsx`** — placeholder with title "Clientes"

### Modify files:

**`src/components/AppSidebar.tsx`**
- Replace menu items: Dashboard, Interações, Clientes, Auditorias, Configurações
- Add client selector dropdown at top (from ClientContext)
- Icons: LayoutDashboard, MessageSquare, Building2, ShieldAlert, Settings

**`src/App.tsx`**
- Wrap authenticated content in `<ClientProvider>`
- Update routes: `/interactions`, `/clients`, `/audits`, `/settings`
- Remove `/integrations`, `/indicators`, `/insights` routes

**`src/pages/Index.tsx`**
- Simplify to CX Hub dashboard placeholder (remove Gist KPI references for now)

### Delete files:
- `src/pages/Indicators.tsx`
- `src/pages/Insights.tsx`
- `src/pages/Integrations.tsx`
- `src/hooks/useGistKPIs.ts`
- `src/components/GistTestPanel.tsx`

### Keep untouched:
- `supabase/functions/gist-proxy/index.ts`
- `src/components/ui/*`
- `src/components/KPICard.tsx`
- `src/components/NavLink.tsx`
- `src/components/DashboardLayout.tsx`
- `src/integrations/supabase/client.ts`

---

## Summary of changes

| Action | Files |
|--------|-------|
| **Create** | `AuthContext.tsx`, `ClientContext.tsx`, `ProtectedRoute.tsx`, `ErrorBoundary.tsx`, `LoginPage.tsx`, `SignupPage.tsx`, `InteractionsPage.tsx`, `ClientsPage.tsx` |
| **Modify** | `App.tsx`, `AppSidebar.tsx`, `Index.tsx` |
| **Delete** | `Indicators.tsx`, `Insights.tsx`, `Integrations.tsx`, `useGistKPIs.ts`, `GistTestPanel.tsx` |
| **Migration** | Drop 5 old tables + 5 enums, create 7 new tables + 4 enums + indexes + RLS + seed |

