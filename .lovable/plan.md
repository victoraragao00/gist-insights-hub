# Remover scroll interno das colunas Kanban

Cards devem empilhar livremente; scroll vertical fica no container principal do Kanban (não na página inteira, pois o app shell é `h-screen overflow-hidden`). Apenas UMA barra horizontal na base e UMA vertical no kanban quando necessário.

## Alterações

### 1. `src/components/demands/KanbanColumn.tsx`
- Coluna: trocar `flex flex-col w-[280px] shrink-0 h-full` por `flex flex-col w-[280px] shrink-0` (sem `h-full`).
- Container de cards: remover `flex-1 min-h-0 overflow-y-auto` → manter só `space-y-2 rounded-lg p-2 mt-2 transition-colors` + estados `isOver`.

### 2. `src/components/demands/TechSwimlanePage.tsx`
- `SwimlaneCell`: já não tem `overflow-y-auto` nem `max-h`, mas remover wrapper `max-w-[280px]` desnecessário se não pedido — manter (escopo é só scroll). Confirmar que célula não tem `max-h-*` (não tem). Sem mudanças necessárias além de garantir.
- Container externo: trocar `h-full overflow-auto px-6 py-4` por `h-full overflow-auto px-6 py-4` (mantém — scroll é da página do kanban como um todo, ok).

### 3. `src/pages/DemandsPage.tsx`
- Container CX kanban (linha 322): trocar `h-full overflow-x-auto overflow-y-hidden` por `h-full overflow-auto` e o inner `flex gap-4 h-full px-6 py-4 min-w-max` por `flex gap-4 px-6 py-4 min-w-max items-start` (remove `h-full`, adiciona `items-start`).

## Verificação m11
Nenhum import deixa de ser usado após as edições.
