# Prompt Lovable — Sprint S2: Integração Gist ↔ Ticket + Comentários

> **Issue:** https://github.com/HyTrackWater/gist-insights-hub/issues/68
> **Fase:** 7.2 — Módulo de Tickets, Sprint S2
> **Pré-requisito:** Sprints S1-A, S1-B, S1-C concluídas
> **Repo:** https://github.com/HyTrackWater/gist-insights-hub
> **Supabase project:** qyfwbmukylyfsgzgocfo

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

Leia CONTEXT.md, AGENTS.md e docs/DESIGN_SYSTEM.md antes de iniciar.

---

## OBRIGATÓRIO

1. Migrations via migration tool — nunca DDL manual
2. RLS usando `user_accessible_client_ids(auth.uid())` — nunca sub-select direto em `user_client_access`
3. `created_by UUID` sem `REFERENCES auth.users(id)` — UUID plain
4. Seguir Checklist CTO m1–m13 em todo código gerado
5. `useMutation` para toda operação de escrita (m9)
6. `sonner` para toasts — nunca `use-toast` (m3)
7. Erros Supabase sempre tratados — `{ data, error }` destructurado (m8)
8. Seguir docs/DESIGN_SYSTEM.md em todas as decisões visuais
9. `ON CONFLICT DO NOTHING` em inserções de vínculo (idempotência)
10. Manter TODO o código existente que não é mencionado neste prompt

## PROIBIDO

1. Tocar em `src/integrations/supabase/*`, `supabase/config.toml`, `.env`
2. `REFERENCES auth.users(id)` em qualquer FK nova
3. Sub-select direto em `user_client_access` nas RLS policies
4. Drawer — usar Sheet (Design System seção 3.1)
5. `use-toast` ou `<Toaster>` duplicado — apenas sonner
6. Arbitrary values Tailwind (`w-[347px]`)
7. Reverter código de componentes existentes (DemandCard, KanbanColumn, etc.)

---

## PARTE 1 — MIGRATIONS

### Migration 1: ALTER TYPE + demand_interactions + demand_comments

**IMPORTANTE:** O ENUM `demand_event_type` já existe mas NÃO contém o valor `'commented'`. É necessário adicionar antes de usar.

```sql
-- Adicionar 'commented' ao ENUM existente
ALTER TYPE demand_event_type ADD VALUE IF NOT EXISTS 'commented';
```

```sql
-- Tabela demand_interactions (vínculo conversa ↔ ticket)
CREATE TABLE demand_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  interaction_id UUID REFERENCES interactions(id) ON DELETE CASCADE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(demand_id, interaction_id)
);

CREATE INDEX idx_demand_interactions_demand ON demand_interactions(demand_id);
CREATE INDEX idx_demand_interactions_interaction ON demand_interactions(interaction_id);

ALTER TABLE demand_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_interactions_select ON demand_interactions
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_interactions_insert ON demand_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_interactions_delete ON demand_interactions
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
```

```sql
-- Tabela demand_comments
CREATE TABLE demand_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demand_comments_demand ON demand_comments(demand_id, created_at ASC);

ALTER TABLE demand_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_comments_select ON demand_comments
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_comments_insert ON demand_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_comments_update ON demand_comments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY demand_comments_delete ON demand_comments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
```

### Migration 2: Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE demand_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE demand_interactions;
```

---

## PARTE 2 — DB FUNCTION: conversas por cliente

```sql
CREATE OR REPLACE FUNCTION get_client_conversations(p_client_id UUID)
RETURNS TABLE (
  conversation_id TEXT,
  message_count BIGINT,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_content TEXT,
  sender_side TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.conversation_id,
    COUNT(*) AS message_count,
    MIN(i.occurred_at) AS first_message_at,
    MAX(i.occurred_at) AS last_message_at,
    (
      SELECT content FROM interactions
      WHERE conversation_id = i.conversation_id AND client_id = p_client_id
      ORDER BY occurred_at DESC LIMIT 1
    ) AS last_content,
    (
      SELECT sender_side FROM interactions
      WHERE conversation_id = i.conversation_id AND client_id = p_client_id
      ORDER BY occurred_at DESC LIMIT 1
    ) AS sender_side
  FROM interactions i
  WHERE i.client_id = p_client_id
    AND i.conversation_id IS NOT NULL
    AND i.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  GROUP BY i.conversation_id
  ORDER BY MAX(i.occurred_at) DESC
  LIMIT 50;
$$;
```

---

## PARTE 3 — HOOKS

### `src/hooks/useDemandInteractions.ts`

```typescript
// useDemandInteractions(demandId)
queryKey: ['demand_interactions', demandId]
staleTime: 30_000
enabled: !!demandId
// SELECT demand_interactions JOIN interactions(content, sender_raw, sender_side, occurred_at, conversation_id)
// ORDER BY interactions.occurred_at ASC

// useClientConversations(clientId)
queryKey: ['client_conversations', clientId]
staleTime: 60_000
enabled: !!clientId
// RPC: get_client_conversations(clientId)

// useConversationMessages(conversationId, clientId)
queryKey: ['conversation_messages', conversationId]
staleTime: 60_000
enabled: !!conversationId
// SELECT * FROM interactions
//   WHERE conversation_id = ? AND client_id = ?
//   ORDER BY occurred_at ASC

// useLinkInteractions() — useMutation
// payload: { demandId, interactionIds: string[], conversationId: string }
// INSERT INTO demand_interactions (demand_id, interaction_id, created_by)
//   VALUES para cada interactionId — ON CONFLICT DO NOTHING
// INSERT demand_activities: event_type='linked_interaction'
//   description: 'X mensagens vinculadas da conversa [conversationId]'
// invalidateQueries(['demand_interactions', demandId])
// invalidateQueries(['demand_activities', demandId])

// useUnlinkInteraction() — useMutation
// DELETE FROM demand_interactions WHERE demand_id = ? AND interaction_id = ?
// invalidateQueries(['demand_interactions', demandId])
```

### `src/hooks/useDemandComments.ts`

```typescript
// useDemandComments(demandId)
queryKey: ['demand_comments', demandId]
staleTime: 30_000
enabled: !!demandId
// SELECT * FROM demand_comments WHERE demand_id = ?
// ORDER BY created_at ASC
// Realtime: subscribe em demand_comments com filtro demand_id

// useCreateComment() — useMutation
// INSERT demand_comments: demand_id, content, created_by = user.id
// INSERT demand_activities: event_type='commented', description='Comentário adicionado'
// invalidateQueries(['demand_comments', demandId])
// invalidateQueries(['demand_activities', demandId])

// useUpdateComment() — useMutation
// UPDATE demand_comments SET content, edited=true, edited_at=now()
// WHERE id = ? AND created_by = auth.uid()
// invalidateQueries(['demand_comments', demandId])

// useDeleteComment() — useMutation
// DELETE FROM demand_comments WHERE id = ?
// invalidateQueries(['demand_comments', demandId])
```

### `src/hooks/useClientDemands.ts`

```typescript
// useClientDemands(clientId)
queryKey: ['client_demands', clientId]
staleTime: 30_000
enabled: !!clientId
// SELECT demands JOIN demand_types(name,color,icon) JOIN ticket_columns(name,color) JOIN demand_areas(name,color)
// WHERE client_id = ? ORDER BY created_at DESC LIMIT 20
```

---

## PARTE 4 — FRONTEND

### 4.1 Seção "Conversas Vinculadas" no DemandDetailSheet

Adicionar nova seção no `DemandDetailSheet.tsx`, abaixo de "Anexos e Links":

**Exibição das conversas vinculadas:**
- Lista de `demand_interactions` agrupada por `conversation_id`
- Cada grupo: cabeçalho com conversation_id (truncado), contagem de mensagens vinculadas, data da primeira mensagem
- Mensagens: sender_raw, badge lado (cliente/uMode — cores do Design System seção 1.1), occurred_at relativo, content truncado 2 linhas
- Botão "Desvincular" por mensagem individual (AlertDialog de confirmação)
- Botão "Vincular conversa" → abre `LinkConversationDialog`

**IMPORTANTE:** Adicionar ícones para os novos event_types no `EVENT_ICONS` do DemandDetailSheet:
- `linked_interaction` → ícone `Link2` (já importado)
- `commented` → ícone `MessageSquare` (importar de lucide-react)

### 4.2 Componente `LinkConversationDialog.tsx`

Novo arquivo: `src/components/demands/LinkConversationDialog.tsx`

- Dialog (NÃO Drawer — Design System seção 3.1)
- Título: "Vincular conversa ao ticket"
- **Passo 1 — Selecionar conversa:**
  - Lista de conversas via `useClientConversations(demand.client_id)`
  - Cada item: data da última mensagem (relativa), contagem total, preview do último conteúdo (truncado 2 linhas)
  - Loading skeleton enquanto carrega
  - Clique na conversa → avança para Passo 2
- **Passo 2 — Selecionar mensagens:**
  - Lista de mensagens via `useConversationMessages(conversationId, demand.client_id)`
  - Cada item: checkbox, sender_raw, badge lado (cliente/uMode), occurred_at relativo, content truncado 3 linhas
  - Botão "Selecionar todas" / "Desmarcar todas" (toggle global)
  - Contagem: "X de Y mensagens selecionadas"
  - Botão "Voltar" → volta para Passo 1
  - Botão "Vincular X mensagens" → `useLinkInteractions()` → fecha dialog
- Empty state: "Nenhuma conversa encontrada para este cliente"

### 4.3 Seção "Comentários" no DemandDetailSheet

Adicionar seção abaixo de "Conversas Vinculadas":

**Lista de comentários:**
- `useDemandComments(demandId)` com Realtime subscription
- Cada comentário: avatar inicial (primeira letra), nome do autor (ou "Você"), data relativa, conteúdo
- Badge "editado" se `edited = true`
- Ações (apenas para o autor — comparar `created_by` com `user.id`):
  - Botão editar → transforma em textarea inline com botões Salvar/Cancelar
  - Botão excluir → AlertDialog de confirmação

**Input de novo comentário:**
- Textarea com placeholder "Adicionar comentário..."
- Botão "Comentar" — desabilitado se vazio ou mutation pending
- Submit via `useCreateComment()`
- Limpar textarea após sucesso

### 4.4 Tab "Demandas" na ClientDetailPage

Adicionar aba "Demandas" em `ClientDetailPage.tsx` — posicionar após a aba "Visão Geral":

**Conteúdo da aba:**
- 4 KPI cards no topo: Total, Abertos (não em coluna com `triggers_finished_at`), Concluídos (coluna com `triggers_finished_at`), Bloqueados (`is_blocked = true`)
- Lista dos últimos 20 tickets via `useClientDemands(clientId)`:
  - Título, badge tipo (cor + ícone), badge prioridade, nome da coluna atual (cor), assignee, data relativa
  - Clique no ticket → navega para `/demands` e abre o Sheet com aquele ticket
- Botão "Nova demanda" → abre `CreateDemandDialog` pré-preenchido com `client_id`
- Loading skeleton, empty state "Nenhuma demanda para este cliente"

---

## ESCOPO DE ARQUIVOS

| Arquivo | Ação |
|---|---|
| Nova migration | demand_interactions + demand_comments + ALTER TYPE + indexes + RLS |
| Nova migration | Realtime publications |
| Nova migration | DB function get_client_conversations |
| `src/hooks/useDemandInteractions.ts` | Novo — queries + mutations para vínculos |
| `src/hooks/useDemandComments.ts` | Novo — queries + mutations + Realtime para comentários |
| `src/hooks/useClientDemands.ts` | Novo — query de demands por client_id |
| `src/components/demands/LinkConversationDialog.tsx` | Novo — dialog 2 passos |
| `src/components/demands/DemandDetailSheet.tsx` | Modificar — adicionar seções Conversas Vinculadas + Comentários + ícones EVENT_ICONS |
| `src/pages/ClientDetailPage.tsx` | Modificar — adicionar tab "Demandas" |

---

## VERIFICAÇÃO PÓS-DEPLOY

**SQL (Operador executa):**
```sql
-- 1. Tabelas novas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('demand_interactions', 'demand_comments');
-- Esperado: 2 linhas

-- 2. RLS ativo
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('demand_interactions', 'demand_comments');
-- Esperado: rowsecurity = true em ambas

-- 3. Unique constraint em demand_interactions
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'demand_interactions' AND constraint_type = 'UNIQUE';
-- Esperado: 1 linha

-- 4. DB function criada
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_client_conversations';
-- Esperado: 1 linha

-- 5. Realtime publications
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('demand_comments', 'demand_interactions');
-- Esperado: 2 linhas

-- 6. ENUM atualizado
SELECT unnest(enum_range(NULL::demand_event_type));
-- Esperado: inclui 'commented'
```

**Funcional (11 itens):**
1. Abrir ticket → seção "Conversas Vinculadas" aparece?
2. Clicar "Vincular conversa" → dialog abre com lista de conversas do cliente?
3. Selecionar conversa → mensagens carregam com checkboxes?
4. "Selecionar todas" → todas marcadas? Desmarcar funciona?
5. Confirmar → mensagens aparecem no ticket + activity log registra?
6. Desvincular mensagem → AlertDialog aparece e remove?
7. Comentário criado → aparece em tempo real sem refresh?
8. Editar comentário → badge "editado" aparece?
9. Excluir comentário → AlertDialog de confirmação?
10. Tab "Demandas" na ClientDetailPage mostra KPIs e lista?
11. Botão "Nova demanda" na ClientDetailPage pré-preenche o cliente?

Reportar ao Operador: os 11 itens passaram?
