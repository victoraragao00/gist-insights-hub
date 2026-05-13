## Datas planejadas e reais nas demandas + correção: concluir subdemandas

### Parte A — Datas planejadas/reais (já planejado anteriormente)

Mantida a proposta original:

- **Migration**: adicionar `planned_start_date date`, `planned_end_date date` em `demands` + trigger `validate_demand_planned_dates` (`BEFORE INSERT OR UPDATE OF planned_*, project_id`) com mensagens em PT-BR.
- **Hook**: `useDemands.ts` inclui os 2 campos no `select` e em `DemandRow`.
- **UI**: nova seção "Datas" em `DemandSidebar`, no padrão de `ProjectDatesSection`:
  - Início previsto / Fim previsto editáveis (popover Calendar, `new Date(value + "T00:00:00")` para evitar fuso).
  - Início real (`started_at`) / Conclusão real (`finished_at`) read-only com badge "automático ao entrar em <coluna>".
  - Texto auxiliar "Limite: <data do projeto>" quando há `project_id`.
- **Card Kanban (opcional)**: badge `planned_end_date` em `DemandCard`, vermelho se atrasado.

### Parte B — Correção: time não consegue concluir subdemandas em aberto

**Diagnóstico**

Existem 3 triggers ativos em `demand_tasks`:
- `trg_demand_task_dates` — `BEFORE UPDATE OF status` → preenche `started_at` / `finished_at`. OK.
- `trg_demand_tasks_updated_at` — atualiza `updated_at`. OK.
- `trg_demand_tasks_auto_complete` — `AFTER UPDATE OF status` → quando a **última** subdemanda vai para `done`, faz `UPDATE demands SET column_id = <coluna de finished_at>, finished_at = now()`.

A função `check_demand_auto_complete` é a causa provável: ao mover a demanda-pai para a coluna de "Concluído", dispara as triggers do `demands` (`set_demand_started_finished`, `set_demand_sla_first_response_at`, etc.). Se qualquer uma falhar (coluna de finish não configurada, conflito com `cancellation_reason`, RLS de `ticket_columns`, ou erro silencioso retornando 0 linhas que vira erro genérico no PostgREST), o `UPDATE demand_tasks` original aborta com erro confuso ("conclusão automática falhou") e o usuário vê "não consegui marcar como concluída".

Outros candidatos secundários:
- `useUpdateDemandTask` não destrutura `{ data, error }` em todas as chamadas — qualquer 400/409 vira toast genérico, sem o `details` real do Postgres.
- `TaskStatusSelect` chama `onUpdate({ status: v })` sem optimistic update; se a mutation rejeitar mas o toast for genérico, o time não entende que falhou.

**Correções**

1. **Migration de hardening do auto-complete** (`supabase/migrations/<novo>.sql`):
   ```sql
   CREATE OR REPLACE FUNCTION public.check_demand_auto_complete()
   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   DECLARE
     v_total INT; v_done INT; v_finish_column_id UUID;
   BEGIN
     IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
       SELECT COUNT(*), COUNT(*) FILTER (WHERE status='done')
         INTO v_total, v_done FROM demand_tasks WHERE demand_id = NEW.demand_id;

       IF v_total > 0 AND v_total = v_done THEN
         SELECT id INTO v_finish_column_id
           FROM ticket_columns
           WHERE triggers_finished_at = true
             AND workspace = (SELECT workspace FROM demands WHERE id = NEW.demand_id)
           LIMIT 1;

         IF v_finish_column_id IS NOT NULL THEN
           BEGIN
             UPDATE demands
               SET column_id = v_finish_column_id,
                   finished_at = COALESCE(finished_at, now()),
                   updated_at = now()
             WHERE id = NEW.demand_id
               AND cancellation_reason IS NULL
               AND finished_at IS NULL;
           EXCEPTION WHEN OTHERS THEN
             -- Não bloquear a conclusão da subdemanda se a movimentação da pai falhar
             RAISE WARNING 'Auto-complete da demanda % falhou: %', NEW.demand_id, SQLERRM;
           END;
         END IF;
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$;
   ```
   Diferenças: (a) `BEGIN/EXCEPTION` isola a falha do auto-move — a subdemanda **sempre** completa; (b) filtra `ticket_columns` pelo `workspace` da demanda (hoje pega qualquer coluna global); (c) `RAISE WARNING` aparece nos logs para diagnóstico futuro.

2. **`useUpdateDemandTask` mais explícito** (`src/hooks/useDemandTasks.ts`):
   - Trocar `const { error } = ...` por `const { data, error } = await supabase.from("demand_tasks").update(fields).eq("id", id).select("id").single();`
   - Em `onError`, exibir `err.message + (err as any).details` para o time entender a causa raiz no toast.

3. **`TaskStatusSelect` com loading state** (`DemandTasksSection.tsx`):
   - Trocar `onUpdate({ status: v })` por uma versão que desabilita o trigger durante a mutation.
   - Se a mutation falhar, reverter visualmente.

4. **Verificação pós-deploy**:
   - Criar demanda com 2 subdemandas em workspace que tenha coluna com `triggers_finished_at = true`.
   - Marcar uma como `done` → status persiste, demanda-pai não muda.
   - Marcar a segunda como `done` → status persiste, demanda-pai vai para "Concluído", `finished_at` preenchido.
   - Repetir em workspace **sem** coluna `triggers_finished_at`: a subdemanda ainda assim conclui sem erro (warning no log).
   - Conferir `select * from public_postgres_logs where ... 'Auto-complete'` se houver warnings.

### Arquivos finais

- `supabase/migrations/<plan_dates>.sql` — colunas + trigger de validação (Parte A)
- `supabase/migrations/<auto_complete_fix>.sql` — `check_demand_auto_complete` blindada (Parte B)
- `src/hooks/useDemands.ts` — campos planejados
- `src/hooks/useDemandTasks.ts` — error handling com `details`
- `src/components/demands/detail/DemandSidebar.tsx` — seção "Datas"
- `src/components/demands/detail/DemandTasksSection.tsx` — loading/erro no `TaskStatusSelect`
- `src/components/demands/DemandCard.tsx` (opcional) — badge de prazo

### Fora do escopo

- Não alterar `set_demand_task_dates` (já correto).
- Não mudar RLS de `demand_tasks` (USING cobre o caso).
- Não criar histórico de transições de subdemanda.
