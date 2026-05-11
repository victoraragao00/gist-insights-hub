## Problema

Status do projeto exibido nos cards (`Planejamento`, `Ativo`, `Concluído`) é calculado pela função SQL `get_project_stats`. A regra atual é:

```
planning  → total_demands = 0  OU  completion_pct = 0
active    → completion_pct > 0  (pelo menos 1 demanda finalizada)
completed → completion_pct = 100
cancelled → cancelled_at IS NOT NULL
```

Por isso projetos com demandas **em andamento** (started_at preenchido mas ainda não concluídas) continuam aparecendo como "Planejamento" — só viram "Ativo" depois que a primeira demanda é concluída.

## Correção

Ajustar `get_project_stats` para considerar `active` sempre que houver pelo menos uma demanda iniciada (com `started_at IS NOT NULL`) ou já concluída, mantendo `planning` apenas para projetos sem nenhum trabalho em curso.

Nova regra:

```
cancelled → cancelled_at IS NOT NULL
completed → total > 0  E  completion_pct = 100
active    → existe demanda com started_at IS NOT NULL  OU  completed > 0
planning  → caso contrário (sem demandas, ou todas ainda não iniciadas)
```

## Implementação

Migration única que substitui `get_project_stats` adicionando contagem de demandas iniciadas:

```sql
SELECT COUNT(*) INTO v_started
FROM demands
WHERE project_id = p_project_id
  AND started_at IS NOT NULL
  AND cancellation_reason IS NULL;

v_status := CASE
  WHEN v_project.cancelled_at IS NOT NULL THEN 'cancelled'
  WHEN v_total > 0 AND v_completion_pct = 100 THEN 'completed'
  WHEN v_started > 0 OR v_completed > 0 THEN 'active'
  ELSE 'planning'
END;
```

Restante da função (overdue, hours, by_column, return) permanece igual.

## Verificação

1. Projeto com 0 demandas → `Planejamento` ✓
2. Projeto com demandas só na 1ª coluna (não iniciadas) → `Planejamento` ✓
3. Projeto com pelo menos 1 demanda em coluna que dispara `triggers_started_at` → `Ativo` ✓
4. Projeto com todas as demandas finalizadas → `Concluído` ✓
5. Projeto com `cancelled_at` → `Cancelado` ✓

Como `useProjectStats` tem `staleTime` curto e é re-buscado ao abrir a página, os cards refletirão o novo status sem mudanças no frontend.

## Arquivos

- nova migration em `supabase/migrations/` recriando `get_project_stats`

Sem mudanças de frontend.