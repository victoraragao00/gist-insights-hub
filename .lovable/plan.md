

## Plan: Melhorar aba Visão Geral — HTML fix, tema, tooltip, filtros, interatividade

### Overview

Four changes to the "Visão Geral" tab in `ClientDetailPage.tsx`: fix raw HTML in the occurrences table, add theme column with tone tooltip, add tone filter buttons, and add click interactivity (row → Interactions tab, chart bar → filter table by date).

### Changes — `src/pages/ClientDetailPage.tsx`

**1. Interface + Query update**
- Add `theme`, `conversation_id` to `Interaction` interface
- Add `theme, conversation_id` to the Supabase `.select()` on line 294

**2. Controlled Tabs + new state**
- Change `<Tabs defaultValue="overview">` to controlled: `<Tabs value={activeTab} onValueChange={setActiveTab}>`
- Add state: `activeTab` (default `"overview"`), `selectedTone` (default `"todos"`), `selectedDate` (default `null`)

**3. Fix HTML rendering (line 758)**
- Replace `{i.content?.slice(0, 150) ?? "—"}` with `dangerouslySetInnerHTML={{ __html: i.content ?? "—" }}` inside a `<span className="line-clamp-2">`

**4. Theme column + Tone tooltip**
- Add `<TableHead>Tema</TableHead>` after Tom column header
- Add helper `getToneTooltip(tone, theme)` returning natural-language explanation
- Wrap tone Badge with `TooltipProvider > Tooltip > TooltipTrigger > TooltipContent`
- Add Theme cell with neutral badge (`bg-muted text-muted-foreground`) or "—"

**5. Tone filter buttons**
- Above the occurrences table, add toggle buttons: Todos / Atenção / Alerta / Crítico
- Filter `nonOkInteractions` by `selectedTone` before rendering
- Also filter by `selectedDate` when set

**6. Chart click → filter by date**
- Add `onClick` to each `<Bar>` in the tone trend chart
- When clicked, set `selectedDate` to the raw day value
- Show a filter badge "Filtrando: {date}" with X button to clear
- Apply opacity styling to non-selected bars via `fillOpacity`
- Need to keep original day string in chart data for filtering (add `rawDay` field to `toneTrendChartData`)

**7. Row click → navigate to Interactions tab**
- Make `<TableRow>` clickable with `cursor-pointer hover:bg-muted/50`
- On click, set `activeTab` to `"interactions"`
- Note: InteractionsFeed doesn't currently accept a conversation filter prop, so clicking will navigate to the tab (conversation filtering would require changes to InteractionsFeed which is out of scope per PROIBIDO rules)

**8. Imports**
- Add `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` from `@/components/ui/tooltip`
- Add `X` from `lucide-react`

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/ClientDetailPage.tsx` |

### No changes to
- Queries (no new RPCs), other tabs, hooks, migrations, RLS, `src/integrations/supabase/*`, `.env`

