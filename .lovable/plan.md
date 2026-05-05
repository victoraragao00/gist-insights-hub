## Colunas colapsadas atravessando raias + sem scroll interno

### 1. TECH swimlane: stub colapsado full-height

**Arquivo:** `src/components/demands/TechSwimlanePage.tsx`

Substituir os múltiplos grids (header + 1 grid por raia) por **um único grid 2D** onde a coluna colapsada ocupa uma célula com `gridRow: 1 / -1`, atravessando header e todas as raias (igual ao print).

- `gridTemplateColumns`: `180px` + `48px` (colapsada) ou `300px` (expandida) por coluna.
- `gridTemplateRows`: `auto` para header + `auto` por raia.
- Headers e células de colunas **expandidas** entram via fluxo normal do grid.
- Para cada coluna **colapsada**, renderizar UM `CollapsedColumnStub` posicionado em `gridColumn: idx + 2, gridRow: 1 / span (lanes.length + 1)` — pular os slots dela no header e nas raias para não duplicar.
- Manter label da raia na primeira coluna de cada linha.

**Arquivo:** `src/components/demands/CollapsedColumnStub.tsx`
- Trocar layout fixo por `h-full` com flex-col: bolinha + contador no topo, nome vertical centralizado (sem `max-h-48`), chevron no rodapé. Assim o stub realmente preenche toda a altura do board.

### 2. Remover scroll vertical interno das colunas (CX)

**Arquivo:** `src/components/demands/KanbanColumn.tsx`

Na área que recebe os cards, remover `flex-1 min-h-0 overflow-y-auto` e o `h-full` do wrapper — a coluna cresce com o conteúdo e o scroll fica a cargo do board externo (que já tem `overflow-auto`). Resultado: zero barra interna por coluna; uma única barra horizontal no board.

TECH não tem scroll interno por célula hoje, então nada a alterar lá além do item 1.

### Verificação

1. TECH: colapsar coluna → tira contínua do topo até o fim da última raia.
2. TECH: largura das raias permanece uniforme.
3. CX: muitas demandas em uma coluna → sem scrollbar interna.
4. CX e TECH: apenas UMA barra horizontal, zero scroll de página.
