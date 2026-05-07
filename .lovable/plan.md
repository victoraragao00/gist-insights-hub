## Objetivo

Adicionar gestão de dependências entre demandas (blocks/related/linked) na UI: vincular pela DemandDetailPage, exibir referência clicável no card do Kanban, sugerir relacionadas como causa de bloqueio e alertar no Dashboard TECH quando uma bloqueante está parada >3 dias.

## Conflito identificado (decisão necessária)

A spec da Feature 5 pede alterar a RPC `get_tech_dashboard_metrics` para incluir `blocking_stalled`, mas a sessão proíbe migrations e edição de `supabase/migrations/*`. Proposta: implementar a Feature 5 **no frontend**, via uma query React Query separada (`useBlockingStalledAlert`) que consulta `demand_relationships` + `demands` diretamente. O alerta vira um 5º card do `AlertCards` consumindo essa query, sem tocar na RPC. Se preferir, posso abrir uma issue separada (LOVABLE_BANCO) para alterar a RPC depois.

## Arquivos a criar

- `src/hooks/useDemandRelationships.ts` — `useDemandRelationships(demandId)`, `useAddRelationship()`, `useRemoveRelationship()`. Tipos exportados (`DemandRelationships`, `DependencyItem`).
- `src/hooks/useBlockingStalledAlert.ts` — query (`staleTime: 60_000`) que retorna demandas TECH em aberto, com `last_updated < now()-3d`, que aparecem como `demand_id` em pelo menos uma relação `blocks`. Inclui `blocks_count` por demanda.
- `src/components/demands/detail/DemandDependenciesSection.tsx` — seção da sidebar com lista (Bloqueada por / Bloqueia / Relacionadas) e formulário de vinculação com toggle de tipo + busca inline (debounce 300ms via `useDebounce` existente; `staleTime: 5_000`; mínimo 3 caracteres).
- `src/components/demands/detail/DependencyChip.tsx` — chip reutilizável (link + remover ao hover).

## Arquivos a editar

- `src/components/demands/detail/DemandSidebar.tsx`
  - Renderizar `<DemandDependenciesSection demand={demand} />` após a seção de Colaboradores.
  - No bloco de bloqueio (form de motivo), adicionar `BlockerCauseSuggestions` (consumindo `useDemandRelationships`) que lista `blocked_by` + `related` em aberto e popula `blockerReason` ao clicar (`Aguardando: <título>`).
- `src/components/demands/DemandCard.tsx`
  - Quando `demand.is_blocked` e `demand.blocker_reason?.startsWith('Aguardando conclusão de:')`, exibir `<p>` com o motivo abaixo do badge `Bloqueado`. Sem fetch extra (string já está em `demands`).
- `src/components/tech-dashboard/AlertCards.tsx`
  - Receber prop opcional `blockingStalled` (do hook novo) e renderizar 5º card `Bloqueantes paradas` com navegação para `/demands?workspace=tech&filter=blocking_stalled`.
- `src/pages/TechDashboardPage.tsx` (consumidor do `AlertCards`)
  - Chamar `useBlockingStalledAlert()` e passar `blockingStalled` ao `AlertCards`.

## Padrões / Checklist CTO

- m4 `staleTime`: 30s (relationships), 5s (busca), 60s (alerta de bloqueante parada).
- m5 `queryKey` inclui `demandId` ou `searchQuery`.
- m9 toda escrita via `useMutation`; toasts via `sonner`.
- m11 zero imports não usados.
- Sem `any`: tipar `DemandRelationships = { blocks_these: DependencyItem[]; blocked_by: DependencyItem[]; related: (DependencyItem & { type: 'related' | 'linked' })[] }`.
- Cores: usar tokens semânticos (`destructive`, `primary`, `muted`) — substituir `text-blue-600`, `bg-purple-50` etc. por tokens do design system uMode.
- Botão "Vincular" usa `<Button variant="ghost" size="sm">` (não `<button>` cru) para aderir ao DS.

## Detalhes técnicos

- A RPC `get_demand_relationships` (já existe no banco) retorna `blocks_these`, `blocked_by`, `related`. O hook expõe `data` tipado via cast a partir de `Json`.
- `useAddRelationship` invalida `['demand-relationships', demandId]`, `['demand-relationships', relatedId]` e `['demands']` (bloqueio é aplicado via trigger no banco). `createdBy` vem de `useUserProfile()`.
- `useRemoveRelationship` faz `delete().eq('id', rel_id)`. Observação: a RPC atual **não retorna `rel_id`**. Para suportar remoção, o componente buscará `rel_id` via uma query auxiliar simples em `demand_relationships` filtrando por `demand_id` ou `related_demand_id` e cruzando com os IDs retornados — mais simples que mudar a RPC. Esta query roda apenas quando a seção é montada.
- `useBlockingStalledAlert`: `select('id, title, last_updated, demand_relationships!demand_relationships_demand_id_fkey(id)')` filtrado por `workspace=tech`, `finished_at is null`, `cancellation_reason is null`, `last_updated < now()-3d`, e contagem `> 0` no client. Caso o embed PostgREST não funcione bem, faz duas queries (`demands` + `demand_relationships`) e cruza no client.
- Form de busca: usa `Input` shadcn + lista absoluta com `z-50`. Estado local `useState`. Fecha após selecionar.
- `BlockerCauseSuggestions` só renderiza se houver itens em aberto; clicar preenche o textarea de motivo via prop callback exposta pelo `DemandSidebar` (já controla `blockerReason`).

## Verificação

1. Sidebar mostra "Dependências" com 3 buckets e botão `+ Vincular`.
2. Vincular `blocks` a outra demanda → trigger marca dependente como `is_blocked=true`; card no Kanban mostra "Aguardando conclusão de: …".
3. Concluir antecessora → dependente desbloqueada (trigger), card atualiza após `invalidateQueries(['demands'])`.
4. Dialog de motivo de bloqueio sugere `blocked_by` + `related` em aberto; clicar preenche.
5. Dashboard TECH mostra card "Bloqueantes paradas" quando há TECH em aberto, com relação `blocks` e `last_updated >= 3 dias`.
6. Sem regressões de lint (`m11`), sem `any`, toasts via `sonner`.