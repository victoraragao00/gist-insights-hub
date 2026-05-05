# Plan — DASH-1B Frontend Dashboard TECH

## Discrepância importante a confirmar
O prompt afirma "todos os gráficos via Chart.js (já usado no projeto)" — porém o projeto **não usa Chart.js**, usa **Recharts** (`recharts ^2.15.4`, presente em `Index.tsx`, `DemandsDashboardPage.tsx`, `ClientDetailPage.tsx`). Adicionar Chart.js criaria stack duplicado e violaria o princípio de consistência do Playbook.

**Proposta:** implementar throughput e cycle time com **Recharts** (mesmo visual do mock — barras empilhadas e histograma). Se o Operador insistir em Chart.js, instalo `chart.js` + `react-chartjs-2`.

## Escopo

### 1. Roteamento e workspace switch
- `App.tsx`: registrar `<Route path="/tech/dashboard" element={<ErrorBoundary><TechDashboardPage /></ErrorBoundary>} />` dentro do `DashboardLayout`.
- `useWorkspace.ts`: o hook **não tem acesso a `navigate`** (é puro). Em vez de injetar `useNavigate` aqui (acopla o hook ao router), expor `setWorkspace` como hoje e fazer o redirect no **chamador** (`WorkspaceSwitcher.tsx`):
  ```ts
  const handleSelect = (ws: Workspace) => {
    setWorkspace(ws);
    if (ws === 'tech') navigate('/tech/dashboard');
    else navigate('/');
  };
  ```
  Isso preserva o hook como utilitário sem dependência de rota.

### 2. Sidebar TECH
`AppSidebar.tsx`: reordenar `techItems` para que **Dashboard** fique em primeiro lugar e renomear:
```
Dashboard | Kanban | Projetos | Pautas Internas
```
Highlight do item ativo já é tratado pelo `isActive` existente.

### 3. Hook `useTechDashboard`
Novo arquivo `src/hooks/useTechDashboard.ts`:
- `useQuery` com `queryKey: ['tech-dashboard', user?.id, periodDays, areaId, projectId]` (inclui `user?.id` por regra de cache do projeto).
- `staleTime: 60_000`, `enabled: !!user`.
- Chama RPC `get_tech_dashboard_metrics`.
- Tipo `TechDashboardData` declarado no próprio arquivo (alerts, throughput, cycle_time, people, forecast, column_time, hours, is_admin).
- Destructure `{ data, error }` e `throw error` (m8).

### 4. Página `TechDashboardPage.tsx`
`src/pages/TechDashboardPage.tsx` com:
- Header sticky: título + seletor de período (botões 7/30/90 + DateRangePicker custom desabilitado por ora — adicionar como TODO se ainda não existir componente).
- `FilterChips` (novo componente) — chips clicáveis para áreas e projetos usando `useDemandAreas` e `useProjects` existentes.
- `AlertCards` — 4 cards clicáveis navegando para `/demands?workspace=tech&filter=<key>`.
- 3 grids de 2 colunas: Throughput+CycleTime, People+Forecast, ColumnTime+Hours.
- `DashboardSkeleton` em loading.
- Tratamento de `error` com toast `sonner`.

### 5. Componentes em `src/components/tech-dashboard/`
- `AlertCards.tsx` + `AlertCard.tsx`
- `FilterChips.tsx`
- `ThroughputChart.tsx` (Recharts BarChart empilhado)
- `CycleTimeCard.tsx` (Recharts BarChart histograma + lista de percentis)
- `PeopleCard.tsx` (lista com avatares + barra WIP)
- `ForecastCard.tsx` (3 cenários + barra de progresso)
- `ColumnTimeCard.tsx` (lista com destaque de gargalo)
- `HoursCard.tsx` (totais + breakdown por área)
- `DashboardSkeleton.tsx`

Tokens: usar `bg-card`, `border-border`, `text-muted-foreground`, `text-emerald-600`, `text-amber-600`, `text-destructive`. Cores específicas dos gráficos via constantes (`#1D9E75`, `#7F77DD`, `#EF9F27`, `#E24B4A`) — manter como no spec pois são tokens de gráfico.

### 6. Filtros via query params no Kanban
`DemandsPage.tsx`:
- Ler `searchParams.get('filter')`.
- `useEffect` aplicando: `blocked` → `is_blocked=true`; `forgotten` → última atividade > 7 dias; `delivered` → `finished_at` no período; `overloaded` → sem filtro extra (o destaque é visual no card).
- Verificar como o estado de filtros atual de `DemandsPage` é gerenciado antes de implementar, para não conflitar com filtros existentes.

### 7. Visibilidade admin/usuário
A RPC já entrega `is_admin` + lista filtrada. `PeopleCard` apenas renderiza o que recebe; título muda conforme `isAdmin`.

## Conformidade Checklist CTO
- m1 sem `any` (tipo `TechDashboardData` explícito)
- m2 `ErrorBoundary` na rota
- m3 apenas `sonner`
- m4 `staleTime: 60_000`
- m5 `queryKey` inclui `user?.id` + filtros
- m8 `{ data, error }` destruturado
- m11 sem imports não usados

## Fora de escopo
- Não cria migration (DASH-1A já entregou a RPC).
- Não altera `src/integrations/supabase/*`, `.env` nem docs.
- DateRangePicker custom: stub com TODO se não existir componente reutilizável (a verificar na implementação).

## Pergunta para destravar
Manter **Recharts** (recomendado, já no projeto) ou instalar Chart.js como o prompt pede?
