## Diagnóstico

A rota `/demands/dashboard` renderiza `src/pages/DemandsDashboardPage.tsx`. O container raiz já tem `h-full overflow-y-auto`, mas:

- A classe `animate-fade-in-up` é aplicada ao próprio container de scroll (transform pode interferir em alguns navegadores e atrapalhar a percepção de scroll quando combinada com `space-y-6` + grid).
- Não há header sticky — ao rolar, o título e os filtros somem, dando sensação de página travada.
- O usuário reportou que conteúdo abaixo da dobra não aparece.

A página é a única afetada — `Index.tsx` (rota `/`) já usa o mesmo padrão e funciona.

## FIX (apenas `src/pages/DemandsDashboardPage.tsx`)

1. Trocar o root de:
   ```tsx
   <div className="h-full overflow-y-auto p-6 space-y-6 animate-fade-in-up">
   ```
   para o padrão do `TechDashboardPage`:
   ```tsx
   <div className="flex flex-col h-full overflow-y-auto animate-fade-in-up">
     <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 shrink-0 flex items-center justify-between flex-wrap gap-3">
       {/* h1 + selects (cliente, período) */}
     </div>
     <div className="px-6 py-4 space-y-6">
       {/* KPI cards, dialog, gráficos, seções CX */}
     </div>
   </div>
   ```

2. Mover `h1 "Dashboard de Demandas"` + os 2 `<Select>` (cliente e dias) para dentro do header sticky.

3. Mover todo o resto (KPIs, Dialog drill-down, charts existentes, seções "Throughput Semanal", "Tempo de Ciclo", "Carga por Pessoa", tabela de bloqueados) para dentro do wrapper de conteúdo `px-6 py-4 space-y-6`.

4. Conferir e remover qualquer import que sobre após a refatoração (m11). Espera-se que nenhum import seja removido — apenas reordenação de JSX.

## Não tocar

- Nenhuma outra página.
- `src/components/DashboardLayout.tsx`, `App.tsx`, hooks, supabase, migrations, docs.

## Verificação manual

1. `/demands/dashboard` → roda scroll vertical até o final ("Carga por Pessoa") e volta.
2. Ao rolar, header com título + filtros permanece fixo no topo.
3. Outras rotas (`/`, `/tech/dashboard`, `/demands`, `/agendas`) inalteradas.

## Arquivos editados

- `src/pages/DemandsDashboardPage.tsx`
