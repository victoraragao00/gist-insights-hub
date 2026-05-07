## Contexto

Hoje as demandas têm:
- **`workspace`** (`cx` | `tech`) na tabela `demands` — define se aparece no board CX Hub ou TECH. **Não há UI para alterar** após a criação.
- **`assignee_id`** — responsável principal (1 só).
- **`demand_collaborators`** — tabela já existe e suporta múltiplos colaboradores; está na sidebar do detalhe, mas pouco visível e não tem cara de "co-responsáveis" (aparece como "Colaboradores").
- **`created_by`** — criador já é registrado.

Ou seja, a infra dos dois pedidos **já existe no banco**. O gap é puramente de UI/UX.

## Mudança 1 — Mover demanda entre boards (CX ↔ TECH)

Adicionar ação "Mover para TECH" / "Mover para CX Hub" em **dois pontos**:

1. **Sidebar do detalhe da demanda** (`DemandSidebar.tsx`) — nova linha "Workspace" com botão para alternar.
2. **Menu de contexto do card** no Kanban (`DemandCard.tsx`) — opção rápida "Mover para TECH/CX".

Comportamento:
- Atualiza `demands.workspace`.
- Como cada workspace tem **áreas próprias** (`demand_areas.workspace`) e **colunas próprias** (`ticket_columns.workspace`), ao mover:
  - Limpa `area_id` (usuário re-seleciona no novo board).
  - Move para a primeira coluna ativa do novo workspace (estado "A Fazer").
- Toast: "Demanda movida para TECH" + invalidação das queries dos dois boards.
- Restrito a **admin ou criador** (RLS já permite update; checagem só de UX).

## Mudança 2 — Múltiplos responsáveis ("Criador + Co-responsáveis")

Renomear/reorganizar a sidebar para deixar a estrutura clara:

```
Criador          [readonly]  Pedro Murillo
Responsável      [select]    Ana Paula  (assignee_id atual)
Co-responsáveis  [+ chip]    [Victor] [Laura] [+]
Observadores     [eye]       (watchers atuais)
```

- **Criador** — mostra `created_by` resolvido em `user_profiles` (somente leitura).
- **Responsável** — mantém `assignee_id` (1 só, o "dono").
- **Co-responsáveis** — UI renomeada de "Colaboradores"; usa `demand_collaborators` (já tem hooks `useAddCollaborator`/`useRemoveCollaborator`). Combobox com busca + chips removíveis.
- Funciona igual em CX e TECH (mesma sidebar).

No **DemandCard** do Kanban, mostrar avatar do responsável + stack de até 2 avatares de co-responsáveis (+N) — `demand_collaborators` já é carregado em batch (`useDemandCollaboratorsBatch`), só falta renderizar o stack.

No filtro **"Minhas tasks"** (já existe) — incluir demandas onde o usuário é co-responsável (`useMyCollaboratorDemandIds` já existe e já é usado, validar que continua funcionando).

## Arquivos a tocar

**Frontend apenas** (sem migration, sem edge function):

- `src/hooks/useDemands.ts` — adicionar mutation `useChangeDemandWorkspace(demandId, newWorkspace)` que atualiza `workspace` + `area_id=null` + `column_id` para a 1ª coluna do novo workspace.
- `src/components/demands/detail/DemandSidebar.tsx`:
  - Nova seção "Workspace" com botão de alternar (AlertDialog de confirmação).
  - Renomear bloco "Colaboradores" → "Co-responsáveis"; adicionar bloco "Criador" (readonly) acima de "Responsável".
- `src/components/demands/DemandCard.tsx` — stack de avatares de co-responsáveis ao lado do responsável (já recebe `collaborators` via prop).
- `src/components/demands/KanbanColumn.tsx` (ou onde está o context menu do card) — item de menu "Mover para TECH/CX".

## Fora de escopo

- Nenhuma migration (schema já suporta tudo).
- Notificações automáticas para co-responsáveis ao mover board (pode ser próximo passo se você quiser).
- Permissões: mantém RLS atual; qualquer admin/criador pode mover.

## Validação

1. Abrir demanda em `/demands/:id` no workspace CX → sidebar mostra "Workspace: CX Hub" com botão "Mover para TECH".
2. Clicar → confirmar → demanda some do board CX, aparece em TECH na coluna "A Fazer", `area_id` zerado.
3. Sidebar mostra Criador (readonly), Responsável (select), Co-responsáveis (combobox + chips).
4. Adicionar 2 co-responsáveis → card no Kanban mostra avatar do responsável + 2 avatares de co-responsáveis.
5. Filtro "Minhas tasks" inclui demanda onde sou co-responsável.