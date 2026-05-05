## Hotfix: Recriar policies de `projects` (INSERT bloqueando criação)

### Diagnóstico
- Frontend (`src/hooks/useProjects.ts` linha 212) já passa `owner_id: user.id` corretamente — **nenhuma mudança de código necessária**.
- O problema está nas RLS policies de `projects`. Recriar todas do zero garante consistência após o hotfix anterior.

### Migration única

```sql
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  public.is_project_accessible(id)
);

CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_delete" ON public.projects FOR DELETE
  USING (owner_id = auth.uid());
```

### Escopo
- Apenas migration de RLS. Sem mudanças de frontend, docs ou config.

### Verificação pós-deploy
- `pg_policies` lista 4 policies (SELECT, INSERT, UPDATE, DELETE) em `projects`.
- Criação de projeto pelo app passa a funcionar.
