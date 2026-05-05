## Plano: RPC `get_tech_dashboard_metrics`

Criar a RPC conforme spec, com **3 ajustes obrigatórios** ao SQL devido a divergências reais entre o spec e o schema do banco. Sem isso, a função falha no `CREATE`.

### Divergências detectadas (verificadas no banco)

1. **`demands.updated_at` não existe.** A coluna real é `last_updated`. Spec usa `d.updated_at` em alertas (blocked/forgotten).
   - Ajuste: trocar `d.updated_at` → `d.last_updated` nos blocos de `blocked` e `forgotten`.

2. **`demand_activities` não tem `action_type`, `metadata` nem `moved_at`.** Colunas reais: `event_type` (enum `demand_event_type`), `from_value`, `to_value`, `description`, `created_by`, `created_at`. Enum não tem `column_changed` nem `reopened` — tem `moved`, `created`, `assigned`, `blocked`, `unblocked`, `edited`, `cancelled`, `linked_interaction`, `commented`.
   - Ajuste **§4 Tempo médio por coluna**: usar `event_type = 'moved'` e calcular duração entre eventos consecutivos via `LEAD(created_at) OVER (PARTITION BY demand_id ORDER BY created_at)`. O `column_id` de destino vem de `to_value::uuid` (assumindo que o trigger grava UUID em `to_value`). Se `to_value` armazenar nome em vez de UUID, fazer JOIN por nome com `ticket_columns`.
   - Ajuste **§7 reopen_count**: enum não tem `reopened`. Aproximar como demandas com `finished_at IS NULL` que possuem ao menos um evento `moved` posterior a um momento em que estiveram em coluna com `triggers_finished_at=true` — ou simplificar para `reopen_count: 0` com `TODO` comentado (preferida; menos risco). Confirmar abordagem com o time antes de inferir.

3. **Convenção CTO §SQL**: o spec viola "IN (SELECT …) — não `= ANY(…)`" só em texto; o SQL em si está OK. Manter.

### Mudanças aplicadas no SQL final

- `d.updated_at` → `d.last_updated` (2 ocorrências em alertas).
- Bloco §4 reescrito com `LEAD()` sobre `demand_activities` filtrado por `event_type='moved'`, JOIN em `ticket_columns` por `to_value::uuid`.
- Bloco §7 `reopen_count` retorna `0` por enquanto (sem evento `reopened` no enum) com comentário `-- TODO: definir evento de reabertura`.
- Resto do SQL permanece **idêntico ao spec**, incluindo: `SECURITY DEFINER`, `STABLE`, `search_path = public`, defaults dos parâmetros, regra admin/self em `overloaded` e `people`, `RAISE EXCEPTION` se não autenticado, `COMMENT ON FUNCTION`.

### Verificação pós-deploy (do spec, sem mudanças)

1. `SELECT proname, prosecdef FROM pg_proc WHERE proname='get_tech_dashboard_metrics';` → `prosecdef=true`
2. `SELECT get_tech_dashboard_metrics(30, NULL, NULL);` → JSON com todas as seções
3. `SELECT get_tech_dashboard_metrics(7, NULL, NULL);`
4. Como usuário não-admin: `SELECT (get_tech_dashboard_metrics())::json->>'is_admin';` → `'false'`

### Arquivos tocados

- 1 migration nova (criada pela migration tool do Lovable).
- Nenhum arquivo de frontend, nenhum dos protegidos (`src/integrations/supabase/*`, `supabase/config.toml`, `.env`).

### Aprovação necessária

Confirmar tratamento do **§7 `reopen_count`** (manter `0` com TODO) e do **§4 `to_value`** (assumir UUID). Se preferir o `reopen_count` real, precisamos definir antes qual evento marca reabertura (provável: trigger novo gravando `event_type='moved'` com `from_value` = coluna `triggers_finished_at`).