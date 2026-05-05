# Plano: Notificações in-app + Menções @usuário

## Estado atual

- `NotificationBell` já existe em `src/components/NotificationBell.tsx` (montado no `DashboardLayout`).
- `useDemandNotifications` já existe (com Realtime e mark-as-read), mas:
  - `staleTime: 10_000` (precisa virar `0`)
  - `limit(20)` → subir para `50`
  - SELECT não traz `demands(id, title)` (o sino não consegue navegar pra demanda certa nem mostrar título)
  - Helper `createDemandNotification` não cobre colaboradores/watchers nem tipos `status_changed`/`blocked`/`unblocked`/`mentioned`.
- Comentários: `DemandConversationsTab.tsx` usa `Textarea` simples + `useCreateComment`. Sem menções, sem renderizador.
- Mutations existentes em `useDemands.ts` (`useUpdateDemand`, `useMoveDemand`) e em `DemandSidebar.tsx` (`handleBlock`/`handleUnblock`) não disparam notificações.

## Mudanças

### 1. `src/hooks/useDemandNotifications.ts`
- `staleTime: 0`, `limit(50)`, SELECT `*, demands:demand_id(id, title)` (FK existe via PostgREST).
- Tipar `demands` opcional no `DemandNotification`.
- Reescrever `createDemandNotification` para aceitar tipos `status_changed | blocked | unblocked | commented | mentioned | moved | assigned | created` e buscar destinatários via helper:
  - `getNotificationRecipients(demandId, excludeUserId)` lê `demands.assignee_id` + `demand_collaborators` + `demand_watchers`, dedup com `Set`, remove `null` e o ator.
- Exportar `createMentionNotifications(demandId, userIds, actorId)` para o caso de menção (não usa watchers).

### 2. `src/components/NotificationBell.tsx`
- Navegar para `/demands/${n.demand_id}` (não `/demands`).
- Mostrar título (`n.demands?.title`) abaixo da mensagem quando disponível.
- Dot de não-lida visual (bolinha primária) à esquerda.

### 3. Disparos de notificação
- **`src/hooks/useDemands.ts`** → `useMoveDemand` (mudança de coluna) e `useUpdateDemand` (quando `column_id`, `is_blocked`, `assignee_id` mudam): chamar `createDemandNotification` com `type: 'status_changed' | 'assigned'`. Já temos `targetColumnName`/`sourceColumnName` no payload do move.
- **`src/components/demands/detail/DemandSidebar.tsx`** → em `handleBlock` (`blocked`, msg com nome do tipo) e `handleUnblock` (`unblocked`).
- **`src/hooks/useDemandComments.ts`** → em `useCreateComment.onSuccess`, disparar `commented` (mensagem `Novo comentário de <full_name>`). Menções tratadas separadamente no input.

### 4. Menções @usuário em comentários
Refatorar o bloco de input do `DemandConversationsTab.tsx` para um componente local `CommentInput`:

- Detectar `@` antes do cursor com regex `/@([\w]*)$/`.
- Popover/dropdown abaixo do textarea com até 5 usuários (busca `useUsers()` ou query inline em `user_profiles` ativos por nome/email).
- Setas ↑↓ + Enter para selecionar; Esc fecha; clique também funciona.
- Inserir como token `@[Nome do Usuário](uuid)` no texto bruto (formato estável para parsing posterior, evitando ambiguidade de nomes com espaços).
- No submit:
  - Extrair `[...text.matchAll(/@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g)]` → array de `userId`.
  - Salvar `content` com tokens (renderizador formata).
  - Após `useCreateComment`, chamar `createMentionNotifications` para mencionados (excluindo autor e quem já receberá `commented`).

Renderização: novo `CommentText` que faz split pelo regex e renderiza menções como `<span class="text-primary font-medium">@Nome</span>`. Substitui `whitespace-pre-wrap` simples na lista de comentários.

### 5. Limpezas
- Remover imports não usados resultantes (m11).
- Sem novas dependências.

## Arquivos tocados
- `src/hooks/useDemandNotifications.ts` (refatorar)
- `src/hooks/useDemands.ts` (disparos em move/update)
- `src/hooks/useDemandComments.ts` (disparo `commented`)
- `src/components/NotificationBell.tsx` (navegação + título)
- `src/components/demands/detail/DemandSidebar.tsx` (disparos block/unblock)
- `src/components/demands/detail/DemandConversationsTab.tsx` (CommentInput + CommentText)
- Novo: `src/components/demands/detail/CommentInput.tsx` e `CommentText.tsx`

## Não-objetivos
- Sem migrations (tabela `demand_notifications` já existe).
- Sem alteração em `supabase/*` ou docs.
- Mantém `sonner` como único toast.
