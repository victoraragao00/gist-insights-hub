
## Plano: Migration C+D — Block History, Agendas Project, Bypass Access

Estado atual no banco (verificado):
- `demand_block_history` — não existe
- Trigger `trg_demand_block_history` — não existe
- `user_profiles.bypass_client_access` — não existe
- `meeting_agendas.project_id` — não existe
- `get_demand_block_metrics` — não existe

Nada do escopo C+D foi aplicado ainda. Executar as 4 migrations exatamente como no prompt, em uma única migration tool call:

### Migration 1 — `demand_block_history`
- Tabela com FKs para `demands`, `blocker_types`, `user_profiles`
- 3 índices (demand, active partial, type partial)
- RLS via `user_accessible_client_ids(auth.uid())` (SELECT/INSERT)

### Migration 2 — Trigger + RPC
- `track_demand_block_history()` SECURITY DEFINER, dispara em UPDATE OF `is_blocked`
- Insere registro ao bloquear, fecha (`unblocked_at`/`unblocked_by`) ao desbloquear
- `get_demand_block_metrics(p_demand_id)` retorna JSON com totals, ativo, horas totais, média, breakdown por tipo

### Migration 3 — `meeting_agendas`
- `ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL`
- `ALTER COLUMN duration_minutes SET DEFAULT 60`
- Índice parcial `idx_meeting_agendas_project`

### Migration 4 — Bypass + Funções
- `user_profiles.bypass_client_access BOOLEAN NOT NULL DEFAULT false`
- Recriar `user_accessible_client_ids(_user_id UUID DEFAULT auth.uid())` honrando `bypass_client_access`
- Recriar `get_project_stats(p_project_id)` adicionando campo `meeting_hours` (somatório de `duration_minutes/60` de pautas `internal` vinculadas ao projeto)

### Verificação pós-deploy
Rodar as 5 queries de verificação do prompt e confirmar que `get_project_stats` retorna `meeting_hours`.

Nenhuma alteração de frontend ou de arquivos protegidos.
