## Contexto

A página de Analytics no sidebar é `/demands/dashboard` → `src/pages/DemandsDashboardPage.tsx`. Ela já tem KPIs, drill-downs, distribuição por tipo/prioridade/área e tendência semanal, com filtro de cliente e seletor de dias (`days` state, valores 7/30/90).

Os componentes de fluxo já existem em `src/components/tech-dashboard/`: `ThroughputChart`, `CycleTimeCard`, `ColumnTimeCard`, `PeopleCard` — usados hoje pelo `TechDashboardPage`.

A RPC `get_cx_analytics_metrics` ainda não existe no banco.

## Implementação

### 1. Migration — criar RPC `get_cx_analytics_metrics`

Aplicar via migration tool a função SQL fornecida no prompt (filtra `workspace = 'cx'`, recebe `p_period_days` e `p_client_id`, retorna `throughput`, `cycle_time`, `column_time`, `people`).

Observação: o prompt diz "Não criar migration" mas fornece a SQL da RPC. Interpretar como "não alterar schema/tabelas" — a função é necessária e será criada via migration. Confirmar com Operador se houver dúvida.

### 2. Hook `useCxAnalytics`

Criar `src/hooks/useCxAnalytics.ts`:
- `useQuery` com `queryKey: ['cx-analytics', periodDays, clientId, user?.id]`
- `staleTime: 60_000`
- `enabled: !!user`
- Tipar retorno (`CxAnalyticsMetrics`) — sem `any` (m1)
- Destrutura `{ data, error }` e lança erro (m8)

### 3. Atualizar `DemandsDashboardPage.tsx`

- Importar `useCxAnalytics`, `ThroughputChart`, `CycleTimeCard`, `ColumnTimeCard`, `PeopleCard`
- Chamar `useCxAnalytics(days, selectedClientId === 'all' ? undefined : selectedClientId)` — reutiliza state `days` e `selectedClientId` existentes (não duplicar seletor; o seletor 7/30/90 já existe via `<Select>` `setDays`)
- Após as seções existentes, adicionar 3 novas `<section>`:
  - **Throughput Semanal** — `<ThroughputChart>` + card "Resumo" (concluídas, criadas, taxa de entrega com cor condicional emerald/amber via tokens semânticos)
  - **Tempo de Ciclo** — `<CycleTimeCard>` + `<ColumnTimeCard>` em grid 2 colunas
  - **Carga por Pessoa** — `<PeopleCard isAdmin={true}>` (full width)
- Estados de loading via `Skeleton` quando `cxMetrics` ainda não chegou
- Zero imports não usados (m11)

### 4. Verificar scroll vertical

A página já está dentro do layout com scroll (regra anterior). Confirmar que o container raiz não tem `overflow-hidden` que quebre as novas seções.

## Arquivos

**Criar:**
- `supabase/migrations/<timestamp>_create_get_cx_analytics_metrics.sql`
- `src/hooks/useCxAnalytics.ts`

**Editar:**
- `src/pages/DemandsDashboardPage.tsx`

**Reutilizar (sem alterar):**
- `src/components/tech-dashboard/ThroughputChart.tsx`
- `src/components/tech-dashboard/CycleTimeCard.tsx`
- `src/components/tech-dashboard/ColumnTimeCard.tsx`
- `src/components/tech-dashboard/PeopleCard.tsx`

## Checklist CTO aplicável
m1 (tipos), m4 (staleTime 60s), m5 (queryKey completo com user.id), m8 (error tratado), m11 (zero imports não usados).
