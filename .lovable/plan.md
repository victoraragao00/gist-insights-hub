## 1. SLA por tipo de demanda (e prioridade)

**Hoje:** `sla_configs (client_id, priority, hours_limit)` define SLA só por prioridade. Não é possível diferenciar Suporte × Melhoria, nem desativar SLA para um tipo.

**Mudança no banco** (migration):
- Adicionar coluna `demand_type_id uuid NULL` em `sla_configs` (NULL = vale para todos os tipos, mantém retrocompatibilidade).
- Adicionar coluna `enabled boolean NOT NULL DEFAULT true`. Quando `false`, demandas daquele tipo/cliente/prioridade ficam **sem SLA** (não entram no painel de SLA, não viram "vencido").
- Trocar a unique constraint `(client_id, priority)` por `(client_id, demand_type_id, priority)` usando expressão `COALESCE(demand_type_id, '00000000-...')` ou índice único parcial.
- Atualizar `get_demands_with_sla(p_user_id)`:
  - Resolução em cascata: `(client + type + priority)` → `(client + priority, type NULL)` → `(global + type + priority)` → `(global + priority, type NULL)` → default 8h.
  - Se a config resolvida tiver `enabled = false`, **excluir** a demanda do retorno (fica fora do painel SLA).

**Mudança no frontend (`SlaSettingsTab.tsx` + `useSlaConfigs.ts`):**
- Reorganizar a aba em duas dimensões: seletor de **Cliente** (já existe) + seletor de **Tipo de demanda** (novo, com opção "Todos os tipos" = `demand_type_id IS NULL`).
- Para cada combinação, a tabela de 4 prioridades passa a ter 3 colunas: Horas, Toggle "SLA ativo", Origem (Personalizado / Global / Desativado).
- Permitir reset (remove a linha custom e cai no nível anterior).
- `useSlaConfigs` aceita `(clientId?, demandTypeId?)` e a query passa a filtrar pelas duas dimensões.

**Comunicação visual:** quando o tipo está desativado, mostrar badge "Sem SLA" e esconder o input de horas.

---

## 2. Ordenação configurável dos cards no Kanban

**Hoje:** `useDemands.ts` ordena por `position ASC` dentro de cada coluna (drag & drop manual). Não há opção de ordenar por idade ou prioridade.

**Mudança no banco** (migration):
- Inserir em `app_settings` a chave `kanban_sort_mode` com valores possíveis: `manual` (default, posição via DnD), `oldest_first` (created_at ASC), `newest_first` (created_at DESC), `priority` (urgent → high → medium → low, depois created_at ASC como tiebreaker).
- Já existe RLS de `app_settings` permitindo leitura por todos e update por admin → reaproveitar.

**Mudança no frontend:**
- Nova subseção em **Configurações → Demandas** chamada "Ordenação dos cards no Kanban", com 4 radio options claros e descrição do que cada um faz. Apenas admin edita; demais usuários veem o valor atual.
- Hook novo `useKanbanSortMode()` (React Query, staleTime alto) que lê/escreve a chave.
- Em `useDemands.ts` (e nos lugares que listam demandas por coluna), aplicar a ordenação no client após o fetch:
  - `manual` → mantém `position ASC` (comportamento atual; DnD continua funcionando).
  - `oldest_first` / `newest_first` → ordena por `created_at`; **desabilita o drag & drop** entre posições dentro da coluna (mover entre colunas continua) e mostra um aviso discreto no topo do board.
  - `priority` → ordena por peso de prioridade + `created_at` ASC; idem desabilita reorder manual dentro da coluna.

---

## Arquivos a editar

**Backend (Lovable — migration):**
- `supabase/migrations/<novo>.sql` — alter `sla_configs`, recriar `get_demands_with_sla`, seed de `app_settings.kanban_sort_mode`.

**Frontend:**
- `src/hooks/useSlaConfigs.ts` — assinatura com `demandTypeId`, suporte a `enabled`.
- `src/components/settings/SlaSettingsTab.tsx` — seletor de tipo + toggle de ativação.
- `src/hooks/useKanbanSortMode.ts` — novo hook (read/write `app_settings`).
- `src/components/settings/DemandTypesSettingsTab.tsx` ou nova `KanbanSortSettingsTab.tsx` — UI das 4 opções.
- `src/pages/SettingsPage.tsx` — registrar nova aba/subseção.
- `src/hooks/useDemands.ts` — aplicar sort mode; expor flag `canReorder`.
- `src/pages/DemandsPage.tsx` (Kanban) — desabilitar DnD dentro de coluna quando modo ≠ manual + aviso visual.

Sem mudanças em hooks de notificação, comments ou attachments.
