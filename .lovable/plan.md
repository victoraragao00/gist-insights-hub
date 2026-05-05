# Unificar Kanban CX e TECH

Objetivo: paridade visual e comportamental total entre CX (Kanban flat) e TECH (Swimlane). Card único, header de coluna compartilhado, colapso idêntico.

Estado atual confirmado:
- `SwimlaneDemandCard.tsx` já não existe.
- `DemandCard.tsx` já é compartilhado, mas o estilo diverge da referência CX (cores de Tipo/Área diferentes, avatar azul em vez de roxo, badges sem o visual final).
- `KanbanColumn` (CX) tem colapso para 48px com nome vertical. `TechSwimlanePage` colapsa para 48px também, mas o header é renderizado de forma própria (linha única no topo do grid, sem tratamento idêntico ao CX).
- API atual de DnD do `DemandCard` usa props soltas (`dragRef`, `dragAttributes`...). Spec pede um único objeto `draggable`.

## Mudanças

### 1. `src/components/demands/DemandCard.tsx` (refatorar)
- Trocar API de DnD por uma única prop opcional `draggable?: { ref, attributes, listeners, isDragging, style? }`.
- Reescrever layout seguindo o spec da imagem 1 (referência CX):
  - Linha 1 (Tipo+Área+Prioridade): badges altura `h-5`, texto `text-[11px]`. Tipo com fundo teal (`bg-teal-50/...`), Área com `bg-muted/60`, Prioridade via novo `PriorityBadge` (usa `priorityBadgeClass` + `priorityLabel` já existentes em `detail/priorityBadgeStyles.ts`).
  - Título: `text-sm font-medium leading-snug line-clamp-2`.
  - Linha Bloqueado/Aging: badges destrutivo + aging.
  - Linha Cliente + "há Xt".
  - Linha Responsável (avatar roxo `bg-purple-100/...` com iniciais) + chips horas/tasks com pill (`rounded-full px-1.5 py-0.5`), task chip verde quando `done === total`.
- Manter `taskCounts` e `hoursTotals` via `getDemandCardData`.
- Adicionar componente local `PriorityBadge` (ou inline) que reusa `priorityBadgeClass`/`priorityLabel`.

### 2. Novo `src/components/demands/KanbanColumnHeader.tsx`
- Header compartilhado entre CX e TECH (modo expandido).
- Props: `column`, `count`, `isCollapsed`, `onToggle`, `onAddDemand?`.
- Botão `+` só aparece se `onAddDemand` definido e não colapsado (CX usa, TECH omite).
- Visual conforme spec (chevron rotacionado quando colapsado, círculo de cor da coluna, contador em pill).

### 3. Novo `src/components/demands/CollapsedColumnStub.tsx`
- Visual compartilhado da coluna colapsada (48px, nome vertical, contador, círculo de cor).
- Usado tanto pelo `KanbanColumn` quanto pelas células do `TechSwimlanePage` (no header da coluna, não nas linhas de raias).

### 4. `src/components/demands/KanbanColumn.tsx` (refatorar)
- Atualizar `SortableDemandCard` para usar a nova prop `draggable`.
- Substituir header inline por `<KanbanColumnHeader ... onAddDemand={() => onAddClick(column.id)} />`.
- Substituir bloco colapsado por `<CollapsedColumnStub column={column} count={demands.length} onClick={...} />` (mantendo `useDroppable` ref no wrapper).

### 5. `src/components/demands/TechSwimlanePage.tsx` (refatorar)
- Atualizar `DraggableDemandCard` para usar a nova prop `draggable`.
- No grid header: trocar `gridTemplateColumns` para `180px` na lane e `48px`/`minmax(280px, 1fr)` por coluna (alinhar com CX) e `transition: 'grid-template-columns 0.2s'`.
- Substituir o header customizado por `<KanbanColumnHeader column={col} count={columnCounts.get(col.id) ?? 0} isCollapsed={isCollapsed(col.id)} onToggle={() => toggleCollapse(col.id)} />` (sem `onAddDemand`). Quando colapsado, renderizar `<CollapsedColumnStub />` no lugar.
- Garantir que cada `SwimlaneCell` colapsada renderize um placeholder vazio de mesmas 48px (já faz isso, ajustar apenas para casar com a nova largura).
- `lanes`: manter; passar `taskCounts` adiante.

### 6. Limpeza
- Confirmar `rg "SwimlaneDemandCard" src/` retorna vazio (já está).
- Remover imports não usados após refator (`User`, `Lock`, etc. — manter os usados).
- Nenhuma alteração em hooks, supabase, migrations.

## Detalhes técnicos

- `useCollapsedColumns` continua sendo a única fonte de verdade do estado de colapso, usado igualmente em `KanbanColumn` e `TechSwimlanePage` (já é o caso).
- Colunas `Concluído`/`Cancelado` já vêm colapsadas por padrão via `triggers_finished_at` (lógica já existente em `useCollapsedColumns`).
- Sem novas dependências. `sonner` permanece para toasts. Apenas `tailwindcss-animate`/transições nativas.

## Verificação manual pós-deploy
1. CX e TECH renderizam cards idênticos (mesmas cores de badge, avatar roxo, chips).
2. Colapso em CX e TECH → 48px, nome vertical, contador, chevron rotacionado.
3. DnD no TECH continua funcionando entre colunas e raias.
4. `rg "SwimlaneDemandCard" src/` → 0 resultados.
5. Card bloqueado e card com tasks exibem mesmos badges nos dois contextos.
