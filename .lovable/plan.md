## Diagnóstico

O código já foi corrigido: `useCreateProject` chama `supabase.rpc("create_project", ...)` e a função `SECURITY DEFINER` está válida no banco com permissão de execução para `authenticated`. O erro 42501 visto no screenshot é da tentativa **antes** do deploy (13:39:20). Após o deploy, **nenhuma chamada nova de criação foi disparada** no log de rede — provavelmente o preview está com bundle antigo em cache.

## Passo 1 — Validar (sem código)

1. **Hard refresh no preview** (Ctrl+Shift+R / Cmd+Shift+R) para invalidar o cache do Vite.
2. Tentar criar um projeto novo.
3. Confirmar no Network que a chamada vai para `POST /rest/v1/rpc/create_project` (e **não** mais para `POST /rest/v1/projects`).

Se isso resolver, encerramos sem alterar código.

## Passo 2 — Se persistir, adicionar guarda-redundante

Caso o erro continue mesmo após o reload (indicando bug residual em algum outro caminho), aplicar:

1. **Frontend — `CreateProjectDialog.tsx`**: adicionar log de `console.info("[create_project] calling RPC", input)` antes do `mutateAsync` para confirmar pelo console qual hook está sendo executado.
2. **Banco — migração**: tornar a policy `projects_insert` ainda mais explícita, exigindo `auth.uid() = owner_id` (em vez de `true`), para que qualquer rota legada exploda com erro mais claro e não passe inserts sem owner.
   ```sql
   DROP POLICY IF EXISTS "projects_insert" ON public.projects;
   CREATE POLICY "projects_insert" ON public.projects
     FOR INSERT TO authenticated
     WITH CHECK (auth.uid() = owner_id);
   ```
   A criação via RPC continua funcionando (ela roda como `postgres` por `SECURITY DEFINER`, bypass de RLS).

## Passo 3 — Limpeza

Remover o `console.info` do passo 2 após confirmação.

## Validação final

- Criar projeto pelo modal → toast "Projeto criado" e item aparece na lista.
- `select id, owner_id from projects order by created_at desc limit 1;` retorna o `owner_id` correto.
- `select count(*) from project_members where project_id = '<novo_id>' and role = 'owner';` retorna 1.
