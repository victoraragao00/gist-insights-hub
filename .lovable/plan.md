## Plano: Criar tabela `demand_tasks` + trigger de auto-conclusão

Implementação de migration isolada conforme spec LOVABLE_TECH_4A. Apenas backend, sem alterações no frontend.

### Etapas

1. **Criar migration única** com os 3 blocos SQL na ordem especificada:
   - Tabela `demand_tasks` (8 campos, 3 índices, trigger `updated_at`, RLS com 4 policies usando `IN (SELECT user_accessible_client_ids(auth.uid()))`)
   - Função `get_demand_task_stats(p_demand_id UUID)` retornando JSON com totais, completion_pct e somas de horas
   - Função + trigger `check_demand_auto_complete` (AFTER UPDATE OF status) que move a demanda para a coluna `triggers_finished_at = true` quando todas as tasks ficam `done`, protegendo demandas já canceladas (`cancellation_reason IS NULL`) e já concluídas (`finished_at IS NULL`)

2. **Verificação pós-deploy** via `supabase--read_query`:
   - Confirmar `rowsecurity = true` em `demand_tasks`
   - Confirmar os 3 índices criados
   - Confirmar o trigger `trg_demand_tasks_auto_complete`
   - Testar `get_demand_task_stats()` com uma demanda existente

### Garantias de conformidade

- SQL copiado **na íntegra** sem adaptações
- Sem coluna `parent_demand_id` em `demands`
- Sem alterações em arquivos protegidos (`src/integrations/supabase/*`, `.env`, etc.)
- Sem alterações de frontend
- Sem alterações em `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`
- RLS usa `IN (SELECT ...)` conforme exigido (não `= ANY`)
- Trigger respeita as duas guardas: `cancellation_reason IS NULL AND finished_at IS NULL`
