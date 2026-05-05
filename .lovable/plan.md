## Diagnóstico

A função `get_tech_dashboard_metrics` está retornando erro 42803 (`aggregate function calls cannot be nested`), por isso `/tech/dashboard` mostra "Não foi possível carregar o Dashboard TECH". O SQL v2 sugerido pelo usuário corrige a estrutura usando CTEs isolados, mas precisa de **3 ajustes obrigatórios** para compilar contra o schema real:

| Problema no SQL fornecido | Realidade no banco | Correção |
|---|---|---|
| `d.updated_at` (várias vezes) | Coluna não existe em `demands` | Usar `d.last_updated` |
| `da.action_type = 'column_changed'` | Coluna se chama `event_type`; valor correto é `'moved'` | Usar `event_type = 'moved'` com `LEAD()` (como na v1) |
| `da.action_type = 'reopened'` | Enum `demand_event_type` não tem `'reopened'` (`created, moved, assigned, blocked, unblocked, edited, cancelled, linked_interaction, commented`) | Manter `reopen_count = 0` com TODO |

Há também uma mudança de **shape** no JSON: a v2 transforma `throughput` de array em objeto (`{ weekly, total_done, total_created, delivery_rate }`). O frontend (`useTechDashboard.ts` e `ThroughputChart.tsx`) precisa ser atualizado para o novo shape.

## O que vou fazer

### 1. Migration: substituir `get_tech_dashboard_metrics` (DROP + CREATE)

Aplica a v2 do usuário com as 3 correções acima:
- `last_updated` no lugar de `updated_at`
- Tempo por coluna usando `event_type = 'moved'` + `LEAD()` (mantém comportamento útil; a fórmula original `COALESCE(da.created_at, now()) - da.created_at` retornaria sempre 0)
- `reopen_count = 0` com TODO no comentário

Mantém: CTEs isolados, percentis com `GREATEST(..., 1)` para evitar divisão por zero, bypass admin, filtros `p_area_id` / `p_project_id`, `SECURITY DEFINER`, `search_path = public`.

### 2. Frontend: alinhar tipos ao novo JSON

- `src/hooks/useTechDashboard.ts`: trocar `throughput: Array<...>` por `throughput: { weekly: Array<...>; total_done; total_created; delivery_rate }`. Ajustar `DeliveredByArea` (sem `area_id`, agora só `area_name`).
- `src/components/tech-dashboard/ThroughputChart.tsx`: ler `data.weekly` (em vez de iterar `data` direto). Usar `data.delivery_rate` direto, removendo o cálculo manual.
- `src/components/tech-dashboard/AlertCards.tsx`: já usa `area_name` — sem mudança funcional.

### 3. Validação pós-deploy

```sql
SELECT (get_tech_dashboard_metrics())::json->>'is_admin';
SELECT ((get_tech_dashboard_metrics())::json->'alerts'->'blocked'->>'count')::int;
SELECT ((get_tech_dashboard_metrics())::json->'forecast'->>'backlog_count')::int;
```

E recarregar `/tech/dashboard` no preview para confirmar render sem erro.

## Fora de escopo

- Repensar a métrica de `column_time` com `from_value`/`to_value` adequados — fica para depois; mantemos o comportamento funcional da v1.
- Definir evento de reabertura (precisa adicionar `'reopened'` ao enum `demand_event_type` em outra sprint).
