

## Plan: Fix FK `meeting_homework_items.converted_to_demand_id` → ON DELETE SET NULL

### Problema
A migration anterior corrigiu apenas `rfis.demand_id`. A FK `meeting_homework_items_converted_to_demand_id_fkey` ainda bloqueia deleção de demandas.

### Migration

```sql
ALTER TABLE public.meeting_homework_items
DROP CONSTRAINT IF EXISTS meeting_homework_items_converted_to_demand_id_fkey;

ALTER TABLE public.meeting_homework_items
ADD CONSTRAINT meeting_homework_items_converted_to_demand_id_fkey
FOREIGN KEY (converted_to_demand_id) REFERENCES public.demands(id)
ON DELETE SET NULL;
```

`SET NULL` preserva o homework item, apenas limpa a referência à demanda deletada.

### Files changed

| Action | File |
|--------|------|
| Migration | Alter FK on `meeting_homework_items.converted_to_demand_id` → `ON DELETE SET NULL` |

### No changes to
- Frontend, hooks, edge functions, `src/integrations/supabase/*`, `.env`

