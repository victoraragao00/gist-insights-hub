

## Plan: Agrupar tabela de ocorrências por conversa

### Alterações em `src/pages/ClientDetailPage.tsx`

**1. Substituir `nonOkInteractions` por `nonOkConversations`**

Replace the `nonOkInteractions` useMemo (lines 455-461) with a `nonOkConversations` useMemo that groups `nonOkData` by `conversation_id`, tracking worst tone, count, last date, and unique themes. Apply `selectedTone` and `selectedDate` filters, then sort by severity descending + recency.

**2. Replace table markup (lines 816-884)**

Replace the per-message table with a per-conversation table:
- Columns: Última ocorrência | Conversa | Pior tom | Msgs não-ok | Temas | (chevron)
- Each row keyed by `conversation_id`
- Date shown via `formatDistanceToNow` with `ptBR` locale
- Conversation ID truncated to 12 chars + "…"
- Worst tone badge with tooltip using `TONE_RUBRIC`
- Themes as outline badges (max 2 shown + "+N" overflow)
- `ChevronRight` icon in last column
- Row click navigates to Interactions tab
- Empty state message preserved

**3. Imports**

`ChevronRight` already imported (line 27). `formatDistanceToNow` needs to be imported from `date-fns`, and `ptBR` from `date-fns/locale`.

**4. Add `formatDistanceToNow` import**

Check if already imported; if not, add:
```typescript
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
```

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/ClientDetailPage.tsx` |

### No changes to
- Queries, hooks, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

