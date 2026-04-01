

## Plan: Cascade delete RFI ao deletar demanda

### Problema
A tabela `rfis` referencia `demands(id)` via `demand_id`, mas sem `ON DELETE CASCADE`. Ao deletar uma demanda, a RFI órfã permanece no banco (ou pode bloquear a exclusão se houver FK constraint).

### Solução — Migration

```sql
-- Drop existing FK and recreate with CASCADE
ALTER TABLE public.rfis
DROP CONSTRAINT IF EXISTS rfis_demand_id_fkey;

ALTER TABLE public.rfis
ADD CONSTRAINT rfis_demand_id_fkey
FOREIGN KEY (demand_id) REFERENCES public.demands(id)
ON DELETE CASCADE;
```

Isso garante que ao deletar uma demanda, a RFI vinculada é automaticamente removida pelo banco.

### Files changed

| Action | File |
|--------|------|
| Migration | Alter FK `rfis.demand_id` → `ON DELETE CASCADE` |

### No changes to
- Frontend, hooks, edge functions, `src/integrations/supabase/*`, `.env`

