

## Plan: Novos usuários sem acesso automático a clientes

### Contexto

Hoje, quando um novo usuário faz login, o `bootstrap-user-access` Edge Function automaticamente cria registros `viewer` em `user_client_access` para **todos os clientes ativos**. Além disso, o trigger `grant_new_client_to_all_users` faz o mesmo quando um novo cliente é criado. Isso precisa mudar: novos usuários (gerentes de contas) devem começar com **zero** clientes visíveis, e um admin configura o acesso via a tela de Permissões.

### Mudanças

#### 1. Migration — Alterar trigger `grant_new_client_to_all_users`

Restringir para conceder acesso apenas a usuários com `global_role = 'admin'`:

```sql
CREATE OR REPLACE FUNCTION public.grant_new_client_to_all_users()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_client_access (user_id, client_id, role)
  SELECT up.id, NEW.id, up.global_role
  FROM user_profiles up
  WHERE up.global_role = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM user_client_access uca
      WHERE uca.user_id = up.id AND uca.client_id = NEW.id
    );
  RETURN NEW;
END;
$$;
```

#### 2. Edge Function — `bootstrap-user-access/index.ts`

Modify Step 4: after creating the `user_profiles` record, check `global_role`. If not `admin`, skip client access insertion entirely and return `{ bootstrapped: true, reason: 'non_admin_no_auto_access' }`. Only admins get auto-granted access to all active clients.

#### 3. No frontend changes needed

- `user_accessible_client_ids()` already returns all active clients for admins (via `global_role = 'admin'` check)
- Non-admin users with zero `user_client_access` rows will see an empty client list
- Admin assigns clients via the existing Permissions sheet (Settings → Equipe & Acessos → Permissões)

### Files changed

| Action | File |
|--------|------|
| Migration | Replace `grant_new_client_to_all_users()` (only grant to admins) |
| Edit | `supabase/functions/bootstrap-user-access/index.ts` (skip auto-grant for non-admins) |

### No changes to
- Frontend components, hooks, RLS policies, `src/integrations/supabase/*`, `.env`

