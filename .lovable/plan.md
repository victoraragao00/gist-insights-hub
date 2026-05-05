## Plan: Subdemandas como aba própria na DemandDetailPage

### Contexto

Sprint 4-B (parte) já foi implementado em loop anterior:
- `src/hooks/useDemandTasks.ts` (queries + mutations)
- `src/components/demands/detail/DemandTasksSection.tsx`
- Chip de progresso em `DemandCard` e `SwimlaneDemandCard`
- Mini progress bar em `ProjectDemandsTab`
- `DemandTasksSection` montado **dentro** da aba Conteúdo

Esta sessão refina o spec: **a seção precisa virar aba própria** entre "Conversas" e "Atividade", com contador dinâmico no label.

### Mudanças

**1. `src/pages/DemandDetailPage.tsx`**
- Adicionar import `useDemandTaskStats` e `DemandTasksSection`.
- Estender `TabValue` para incluir `"tasks"`.
- Inserir `<TabsTrigger value="tasks">` entre Conteúdo e Conversas com label dinâmico:
  - `stats.total === 0` → "Subdemandas"
  - `stats.done === stats.total && stats.total > 0` → "Subdemandas ✓" (verde)
  - caso contrário → "Subdemandas (N)"
- Adicionar `<TabsContent value="tasks">` renderizando `<DemandTasksSection demandId={demand.id} />`.
- Ordem final das abas: **Conteúdo · Subdemandas · Conversas · Atividade**.

**2. `src/components/demands/detail/DemandContentTab.tsx`**
- Remover `import { DemandTasksSection }` e a renderização `<DemandTasksSection demandId={demand.id} />` da aba Conteúdo (evitar duplicação).
- Garantir m11 (zero imports não usados).

### Verificação
- Aba "Subdemandas" aparece entre Conteúdo e Conversas com contador correto.
- Quando todas as tasks done, label fica verde com check.
- Fluxos existentes (criar/editar/deletar/auto-close) continuam funcionando.
- Cards do Kanban e ProjectDetailPage permanecem intocados.
