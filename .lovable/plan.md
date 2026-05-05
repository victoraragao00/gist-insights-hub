## Hotfix: Recursão infinita em RLS de `projects` / `project_members`

### Problema
As policies `projects_select` e `project_members_select` se referenciam mutuamente, causando `infinite recursion detected in policy` ao abrir qualquer projeto.

### Solução
Migration única que:
1. Cria função `is_project_accessible(p_project_id uuid)` como `SECURITY DEFINER` (bypassa RLS, quebra o ciclo).
2. Recria `projects_select` usando a função.
3. Recria `project_members_select` usando a função.
4. Recria `project_members_insert` e `project_members_delete` com check direto em `projects.owner_id` (sem recursão).

SQL exato fornecido no prompt será aplicado na íntegra, na ordem.

### Verificação pós-deploy
- `pg_proc` confirma `prosecdef = true` para `is_project_accessible`.
- `pg_policies` lista as policies recriadas.
- `SELECT * FROM projects LIMIT 5` e `SELECT * FROM project_members LIMIT 5` executam sem erro de recursão.

### Escopo
- Apenas migration. Sem mudanças de frontend, docs ou config.
