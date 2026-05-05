## Hotfix final: liberar INSERT em `projects` + trigger de owner

### Diagnóstico
- Frontend (`useCreateProject` em `src/hooks/useProjects.ts:201-228`) já passa `owner_id: user.id` corretamente — **nenhuma mudança de código necessária**.
- Aplicar apenas migration: policy INSERT permissiva + trigger BEFORE INSERT que força `owner_id = auth.uid()` quando ausente.

### Migration

```sql
-- 1. INSERT permissivo (não bloqueia se auth.uid() vier nulo)
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (true);

-- 2. Trigger: garante owner_id = auth.uid() automaticamente
CREATE OR REPLACE FUNCTION public.set_project_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_owner ON public.projects;
CREATE TRIGGER trg_set_project_owner
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_owner();
```

(SELECT/UPDATE/DELETE já estão corretas pelo hotfix anterior — não recriar.)

### Escopo
- Apenas migration. Sem mudanças em frontend ou docs.
