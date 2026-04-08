

## Plan: Unificar abas Visão Geral + Conversas + Interações com seções colapsáveis

### Overview

Merge the three tabs (overview, conversations, interactions) into a single "Visão Geral" tab with 3 collapsible sections. Add inline conversation expansion showing last 5 messages. Remove the two tab triggers and tab contents.

### Changes — `src/pages/ClientDetailPage.tsx`

**1. New imports**
- Add `Collapsible, CollapsibleTrigger, CollapsibleContent` from `@/components/ui/collapsible`
- Add `Separator` from `@/components/ui/separator`
- Add `BarChart2, ChevronDown` from `lucide-react`

**2. New state variables (near other useState declarations)**
```
const [isGraficosOpen, setIsGraficosOpen] = useState(true);
const [isConversasOpen, setIsConversasOpen] = useState(true);
const [isInteracoesOpen, setIsInteracoesOpen] = useState(false);
const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
```

**3. New inline hook — `useConversationMessages`**
Define inside the file (or as a local function) a query that fetches the last 5 messages from `interactions` filtered by `conversation_id`, ordered desc, reversed for chronological display. `staleTime: 60_000`, `enabled: !!conversationId`.

**4. New inline component — `ConversationMessages`**
Small component that uses `useConversationMessages` and renders:
- Timeline with border-left
- Each message: Badge (uMode blue / Cliente orange) + sender_raw + relative date + content via `dangerouslySetInnerHTML`
- "Ver conversa completa →" button that sets `isInteracoesOpen(true)` and scrolls

**5. Remove tab triggers (lines 727-735)**
Remove `<TabsTrigger value="interactions">` and `<TabsTrigger value="conversations">` from the TabsList. Keep the badge count logic for conversations — move it to the Conversas collapsible header.

**6. Remove tab contents (lines 1111-1119)**
Remove `<TabsContent value="interactions">` and `<TabsContent value="conversations">` blocks.

**7. Wrap existing overview content in 3 Collapsible sections (lines 744-968)**

Replace `<TabsContent value="overview">` content with:

**Section 1: Gráficos e KPIs** (Collapsible, default open)
- Trigger with BarChart2 icon + "Gráficos e KPIs" + rotating ChevronDown
- Content: all existing KPIs, Volume chart, Tone trend, Tone distribution, Non-ok occurrences table, pagination

**Separator**

**Section 2: Conversas** (Collapsible, default open)
- Trigger with MessageSquare icon + "Conversas" + sem_resposta badge count + rotating ChevronDown
- Content: `<ClientConversationsTab>` but modified — each conversation item gets an expand/collapse toggle. When expanded, shows `<ConversationMessages>` inline.
- Note: Rather than modifying `ClientConversationsTab` internally, wrap the existing component and add expand behavior at this level by passing `expandedConversation` and `onToggle` as props, OR embed the conversations list directly here using the existing hook.

**Approach decision**: Since `ClientConversationsTab` is a self-contained component, the cleanest approach is to add optional props `expandedConversation` and `onToggleExpand` to it, and render `ConversationMessages` inside each item when expanded. This keeps the component reusable.

**Separator**

**Section 3: Interações** (Collapsible, default closed)
- Trigger with MessageSquare icon + "Interações" + rotating ChevronDown
- Content: `<InteractionsFeed clientId={client.id} />`

**8. Update `ClientConversationsTab.tsx`**
- Add optional props: `expandedConversation?: string | null`, `onToggleExpand?: (id: string) => void`
- In each `ConversationItem`, add click handler to toggle expand
- When expanded, render `ConversationMessages` component below the item
- Import and use the inline `useConversationMessages` hook (move to a shared location or keep in the tab component)

### New hook — `src/hooks/useConversationMessages.ts`
Small hook querying `interactions` table filtered by `conversation_id`, limit 5, ordered desc then reversed. Returns `{ data, isLoading }`.

### Files changed

| Action | File |
|--------|------|
| New | `src/hooks/useConversationMessages.ts` |
| Edit | `src/components/clients/ClientConversationsTab.tsx` (add expand props + inline messages) |
| Edit | `src/pages/ClientDetailPage.tsx` (collapsible sections, remove 2 tabs) |

### No changes to
- Queries, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`, other tabs

