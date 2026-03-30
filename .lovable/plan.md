

## DT-1 Residuais — 6 Correções Cirúrgicas

### FIX 1 — Index.tsx: HSL hardcoded → TONE_CHART_COLORS
- **File:** `src/pages/Index.tsx` line 273
- Add `TONE_CHART_COLORS` to existing import from `@/lib/colorPalette` (line 3)
- Replace inline HSL config object with `config={TONE_CHART_COLORS}`

### FIX 2 — ClientDetailPage.tsx: bg-green-500 → TONE_BAR_COLORS
- **File:** `src/pages/ClientDetailPage.tsx` lines 712-714
- Add `TONE_BAR_COLORS` to existing import (line 44)
- Replace Tailwind `bg-*` classes with inline `style={{ backgroundColor: TONE_BAR_COLORS[tone] }}` since `TONE_BAR_COLORS` contains HSL strings, not Tailwind classes

### FIX 3 — ClientDetailPage.tsx: simplify cast
- **File:** `src/pages/ClientDetailPage.tsx` line 344
- `(clientDemands as unknown as DemandRow[])` → `(clientDemands as DemandRow[])`

### FIX 4 — useDemandAnalytics.ts: simplify cast
- **File:** `src/hooks/useDemandAnalytics.ts` line 53
- `data as unknown as DemandAnalyticsData` → `data as DemandAnalyticsData`

### FIX 5 — AppSidebar.tsx: add onError to logoutMutation
- **File:** `src/components/AppSidebar.tsx` line 50-56
- Add `onError` handler with `toast.error("Erro ao sair. Tente novamente.")`
- Add `import { toast } from "sonner"` at top

### FIX 6 — DemandsDashboardPage.tsx: error handling on blocked_demands
- **File:** `src/pages/DemandsDashboardPage.tsx` lines 50-76
- Add `useEffect` to show `toast.error("Erro ao carregar tickets bloqueados")` when query errors
- Add `import { toast } from "sonner"` and `useEffect` import

### No changes to
- Edge Functions, migrations, RLS, `src/integrations/supabase/*`, `.env`

