

## Plan: Aba "Conversas" na ClientDetailPage

### 1. Migration — Nova DB function

Criar `get_client_conversations_with_status(uuid)` via migration tool. A function agrupa interações por `conversation_id`, infere status (sem_resposta/em_andamento/inativo), retorna contact_name, last_message, worst_tone, total_messages. `SECURITY DEFINER` + `GRANT EXECUTE TO authenticated`.

### 2. Novo hook — `src/hooks/useClientConversationsStatus.ts`

Hook com `useQuery` chamando `supabase.rpc("get_client_conversations_with_status", { p_client_id })`. `staleTime: 60_000`, `enabled: !!clientId`. Tipo `ConversationWithStatus` exportado.

### 3. Novo componente — `src/components/clients/ClientConversationsTab.tsx`

- Filtros de status: Todos | Sem resposta | Em andamento | Inativo (botões com contagem)
- Lista de conversas com: Avatar (iniciais), nome do contato, badge de status, data relativa, última mensagem (HTML sanitizado via `dangerouslySetInnerHTML`), badge de tom, total de mensagens
- Ordenação: sem_resposta primeiro → em_andamento → inativo
- Empty state contextual por filtro
- Imports: Badge, Avatar, Skeleton, formatDistanceToNow, ptBR, TONE_CONFIG

### 4. Integrar na `src/pages/ClientDetailPage.tsx`

- Novo `TabsTrigger` com `value="conversations"` entre "Interações" e "Participantes" (linha 719-720)
- Badge laranja no tab mostrando contagem de `sem_resposta`
- `TabsContent` com `<ClientConversationsTab clientId={client.id} />`
- Import do componente

### Files changed

| Action | File |
|--------|------|
| Migration | Nova function `get_client_conversations_with_status` |
| New | `src/hooks/useClientConversationsStatus.ts` |
| New | `src/components/clients/ClientConversationsTab.tsx` |
| Edit | `src/pages/ClientDetailPage.tsx` (tab + tab content) |

### No changes to
- Outras abas, `src/integrations/supabase/*`, `.env`, hooks existentes

