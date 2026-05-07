## Plan: RFI sheet, colunas colapsadas como tabs e fundo de raia

### 1. RFI Detail Sheet na RFIsPage
Reusar o `RfiDetailSheet` existente (`src/components/rfis/RfiDetailSheet.tsx`) — não criar novo componente.
- Em `src/pages/RFIsPage.tsx`:
  - Adicionar `useState<RfiRow | null>` para `selectedRfi`.
  - Substituir `onClick={() => navigate(`/demands/${demand.id}`)}` por `onClick={() => setSelectedRfi(rfi)}`.
  - Renderizar `<RfiDetailSheet open onOpenChange rfi demandTitle clientName />` no fim, passando `rfi.demands.title` e `rfi.demands.clients.name`.
  - Remover `useNavigate` se ficar sem uso (m11).
- O sheet existente já tem botão "Abrir demanda" que navega para `/demands/:id` — fechar o sheet em sequência.

### 2. Colunas colapsadas como tabs verticais (lateral direita)

#### KanbanBoard (CX) — `src/components/demands/KanbanColumn.tsx` ou board pai
Localizar o componente que renderiza a lista de colunas (Kanban CX). Refatorar para:
- Separar `expandedColumns` e `collapsedColumns` via `useCollapsedColumns`.
- Wrapper raiz `flex h-full overflow-hidden` com:
  - `<div className="flex-1 overflow-x-auto">` contendo apenas as colunas expandidas (sem stubs no grid).
  - `<aside>` à direita renderizando uma tab vertical por coluna colapsada usando o `CollapsedColumnStub` existente (já está no formato vertical com dot+contador+nome). Manter aceitação de drop.

#### TechSwimlanePage — `src/components/demands/TechSwimlanePage.tsx`
- Calcular `expandedCols` e `collapsedCols`.
- `gridTemplate` baseado apenas em `expandedCols` (`180px ${...300px}`).
- Headers e cells (lanes) iteram só em `expandedCols`.
- Adicionar `<aside>` lateral à direita com tabs verticais (`CollapsedColumnStub`) — clicando, expande de volta.
- Cells colapsados não existem mais no grid (remover branch `if (collapsed)` do `SwimlaneCell`).

### 3. Background por área no Swimlane TECH

#### Migration
- `ALTER TABLE demand_areas ADD COLUMN IF NOT EXISTS background_color TEXT;` + COMMENT.

#### Tipos e hook
- `DemandArea` (`src/hooks/useDemandAreas.ts`): adicionar `background_color: string | null`.
- `useManageAreas.updateArea` já aceita `fields` genéricos — usar para gravar `background_color`.

#### AreaSettingsTab — color picker de fundo
- Em `AreaRow`, ao lado da paleta de cores principal, adicionar input `type=color` (visualmente uma swatch quadrada com placeholder "BG" quando vazio) que dispara `onUpdate({ background_color: value })`.
- Botão pequeno de "limpar" ao lado para voltar a `null` (clique direito ou ícone X) — opcional; se complicado, oferecer apenas o picker.

#### Swimlane lane background
- `useAreasByWorkspace("tech")` já traz `background_color`. Em `SwimlaneLane`:
  - Helper `hexToRgba(hex, alpha)` no mesmo arquivo.
  - `bgStyle = area?.background_color ? { backgroundColor: hexToRgba(area.background_color, 0.12) } : {}`.
  - Aplicar `style={bgStyle}` no container da lane (`<div className="grid ... bg-card/40 ...">` substituir/compor com `bgStyle`).
  - Repassar `bgStyle` para `SwimlaneCell` para que cada célula mantenha o fundo da raia (compõe com `isOver` ainda visível usando `ring`/sobreposição leve).

### 4. Qualidade
- `useMutation` para toda escrita (já é o padrão; `useManageAreas` cobre `background_color`).
- Remover imports não usados (m11) — especialmente `useNavigate` no `RFIsPage` e quaisquer imports residuais nas alterações de Kanban/Swimlane.
- Apenas `sonner`. Sem alterações em arquivos protegidos.

### Verificação
1. Clicar em linha da RFIsPage abre o sheet (sem navegar). Botão na seção da demanda navega e fecha.
2. Colapsar uma coluna no Kanban CX → vira tab vertical na lateral direita; expandir clicando.
3. Mesmo comportamento no Swimlane TECH — grid encolhe ao remover a coluna.
4. Settings → Áreas → segundo color picker grava `background_color`.
5. Swimlane TECH renderiza fundo com 12% de opacidade na raia e células da área; áreas sem cor permanecem neutras; drop zone visível.
