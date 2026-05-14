## 1. Correção de scroll (varredura completa)

**Causa:** `<main>` em `DashboardLayout` usa `overflow-hidden` + `min-h-0`. Páginas que apenas envolvem o conteúdo em `<div className="space-y-6">` (sem `h-full overflow-y-auto`) ficam cortadas — o scroll vertical desaparece.

**Páginas afetadas identificadas na varredura:**
- `src/pages/ClientDetailPage.tsx` (causa principal do relato — abas do cliente)
- `src/pages/SearchPage.tsx`
- `src/pages/Audits.tsx`
- `src/pages/TaskDetailPage.tsx`

**Correção:** trocar o wrapper externo de cada uma para o padrão usado em `ProjectDetailPage`/`ClientsPage`/`SettingsPage`:

```tsx
<div className="h-full overflow-y-auto p-6 space-y-6">
```

Páginas que já estão corretas (auditadas e mantidas): `ProjectDetailPage`, `ProjectsPage`, `ClientsPage`, `AgendasPage`, `SettingsPage`, `RFIsPage`, `DemandsDashboardPage`, `TechDashboardPage`, `DemandsPage`, `DemandDetailPage`, `AgendaDetailPage`.

---

## 2. Refatoração das horas (pré-requisito do item 3)

Hoje há **três fontes** de horas e elas não convergem:

| Fonte | Local | Onde é somado hoje |
|---|---|---|
| `demand_time_entries` (timer + manual) | linhas com `demand_id` e opcional `task_id` | `get_demand_total_hours()` e `get_project_stats.total_hours` |
| `demand_tasks.hours_actual` (numérico, editado direto na subdemanda) | coluna em `demand_tasks` | mostrado isoladamente em `DemandTasksSection`, **nunca somado à demanda nem ao projeto** |
| `demands.actual_effort` (texto livre) | coluna em `demands` | apenas exibição — fora de escopo |

**Regra desejada:**
- Horas da demanda = `Σ demand_time_entries.demand_id = X` + `Σ demand_tasks.hours_actual WHERE demand_id = X`
- Horas do projeto = `Σ` das horas das demandas vinculadas (mesma fórmula acima)

**Migrations:**

1. `get_demand_total_hours(p_demand_id)` — adicionar segundo `SELECT SUM(hours_actual) FROM demand_tasks WHERE demand_id = p_demand_id` ao retorno.
2. `get_project_stats(p_project_id)` — substituir o `v_total_hours` para somar:
   - `demand_time_entries` joined a `demands` do projeto (já existe), **mais**
   - `demand_tasks.hours_actual` joined a `demands` do projeto.
3. Nova RPC `get_client_hours_breakdown(p_client_id)` para o item 3 (ver abaixo) usando a mesma fórmula.

**Frontend (somente leitura — nada de business logic novo):**
- `useDemandTotalHours` continua chamando o RPC; nenhuma mudança de tipo.
- `DemandTasksSection.tsx`: o resumo "X reais" passa a refletir o total da RPC (não recálculo client-side), evitando divergência.
- Invalidação: ao salvar `hours_actual` de uma task em `useUpdateDemandTask`, invalidar também `["demand-total-hours", demandId]` e `["project_stats"]`.

---

## 3. Nova aba "Horas gastas" no cliente

**RPC nova:** `get_client_hours_breakdown(p_client_id uuid)` retorna JSON:

```json
{
  "client_id": "...",
  "total_hours": 0,
  "avulsas": {
    "hours": 0,
    "demand_count": 0,
    "demands": [{ "id", "title", "hours", "started_at", "finished_at" }]
  },
  "projetos": [
    {
      "project_id", "project_name", "hours", "demand_count",
      "demands": [{ "id", "title", "hours" }]
    }
  ]
}
```

Filtros: somente demandas com `client_id = p_client_id` e `cancellation_reason IS NULL`. Avulsas = `project_id IS NULL`.

**Hook:** `src/hooks/useClientHours.ts` — `useQuery(["client-hours", user?.id, clientId])`, `staleTime: 60_000`.

**Componente:** `src/components/clients/ClientHoursTab.tsx`
- KPI grande: total de horas gastas no cliente (`formatHours`)
- Card "Demandas avulsas" com subtotal e tabela colapsável
- Lista de cards por projeto, cada um com subtotal e tabela colapsável das demandas
- Estados: loading skeleton, vazio com ilustração discreta
- Linha clicável abre `/demands/:id` (ou `/projects/:id`)

**Integração:** em `ClientDetailPage.tsx`
- Novo `<TabsTrigger value="hours">Horas</TabsTrigger>` entre "RFIs" e "Participantes"
- `<TabsContent value="hours" className="space-y-4"><ClientHoursTab clientId={client.id} /></TabsContent>`

---

## Arquivos

**Migrations (novas):**
- `supabase/migrations/<ts>_recalc_demand_hours_with_tasks.sql` — atualiza `get_demand_total_hours` e `get_project_stats`
- `supabase/migrations/<ts>_add_get_client_hours_breakdown.sql`

**Frontend:**
- `src/pages/ClientDetailPage.tsx` — wrapper com scroll + novo tab
- `src/pages/SearchPage.tsx`, `src/pages/Audits.tsx`, `src/pages/TaskDetailPage.tsx` — wrapper com scroll
- `src/components/clients/ClientHoursTab.tsx` (novo)
- `src/hooks/useClientHours.ts` (novo)
- `src/hooks/useDemandTasks.ts` — invalidar `demand-total-hours` e `project_stats` após update de `hours_actual`

**Fora de escopo:**
- `demands.actual_effort` (texto livre) continua somente exibição
- Reescrita do design das abas existentes
- Permissões/roles (mantém RLS atual via `client_id IN user_accessible_client_ids`)
