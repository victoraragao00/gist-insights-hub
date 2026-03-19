# Prompt Lovable — Sprint S4: Gestão de Usuários e Permissionamento

> **Issue:** https://github.com/HyTrackWater/gist-insights-hub/issues/70
> **Fase:** 7.4 — Gestão de Usuários
> **Pré-requisito:** Sprints S1-A até S3 concluídas
> **Repo:** https://github.com/HyTrackWater/gist-insights-hub
> **Supabase project:** qyfwbmukylyfsgzgocfo

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

Leia CONTEXT.md, AGENTS.md e docs/DESIGN_SYSTEM.md antes de iniciar.

---

## OBRIGATÓRIO

1. Migrations via migration tool — nunca DDL manual
2. RLS usando `user_accessible_client_ids(auth.uid())` — nunca sub-select direto em `user_client_access`
3. Toda operação de escrita via `useMutation` (m9)
4. `sonner` para toasts — nunca `use-toast` (m3)
5. Erros Supabase sempre tratados — `{ data, error }` destructurado (m8)
6. Seguir docs/DESIGN_SYSTEM.md em todas as decisões visuais
7. Toda funcionalidade desta sprint visível e operável APENAS por admin
8. Paginação real em listas > 50 itens (m12)
9. Manter TODO o código existente que não é mencionado neste prompt

## PROIBIDO

1. Tocar em `src/integrations/supabase/*`, `supabase/config.toml`, `.env`
2. Permitir que viewer ou analyst acesse qualquer parte da aba Usuários
3. Permitir que um admin rebaixe a si mesmo (prevenção de lockout)
4. Drawer — usar Sheet ou Dialog
5. Arbitrary values Tailwind
6. Reverter código de componentes existentes
7. Criar trigger diretamente em `auth.users` — schema reservado do Supabase, NÃO é permitido

---

## NOTAS TÉCNICAS IMPORTANTES

### Trigger em auth.users NÃO é possível
O Supabase NÃO permite criar triggers em `auth.users` (schema reservado). Para criar o `user_profiles` ao signup, usar o mesmo pattern da Fase 7.1: a Edge Function `bootstrap-user-access` (que já roda no primeiro login via `ProtectedRoute`) deve ser estendida para TAMBÉM criar o registro em `user_profiles`.

### `user_accessible_client_ids` não está nas migrations
Esta função foi criada diretamente no Supabase Dashboard. O `CREATE OR REPLACE FUNCTION` na migration vai sobrescrevê-la — isso é intencional e esperado.

### UserRole type
O hook `useUserRole` atual define `type UserRole = "admin" | "viewer"`. Esta sprint adiciona `"analyst"`. O tipo deve ser atualizado para `"admin" | "analyst" | "viewer"`.

### RLS recursiva em user_profiles
A policy SELECT de `user_profiles` NÃO pode fazer sub-select em `user_profiles` (recursão infinita). Usar approach diferente — ver solução abaixo.

---

## PARTE 1 — MIGRATIONS

### Migration 1: user_profiles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,  -- mesmo UUID do auth.users, SEM FK explícita
  email TEXT,
  full_name TEXT,
  global_role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (global_role IN ('admin', 'analyst', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: cada user vê o próprio perfil; admin vê todos
-- Para evitar recursão, a policy do admin usa um CTE materializado
CREATE POLICY user_profiles_select_own ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY user_profiles_select_admin ON user_profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT global_role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- UPDATE: apenas admin atualiza perfis (incluindo o próprio para editar nome)
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT global_role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE INDEX idx_user_profiles_global_role ON user_profiles(global_role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Backfill: criar perfis para usuários existentes
INSERT INTO user_profiles (id, email, full_name, global_role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'viewer'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
```

**IMPORTANTE:** Após a migration rodar, o Operador deve executar manualmente no Supabase Dashboard:
```sql
UPDATE user_profiles SET global_role = 'admin'
WHERE email = '<email_do_operador>';
```

### Migration 2: atualizar user_accessible_client_ids

```sql
-- Admin global vê todos os clients ativos; outros veem apenas os com acesso em user_client_access
CREATE OR REPLACE FUNCTION user_accessible_client_ids(p_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT c.id FROM clients c
  WHERE c.active = true
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = p_user_id AND global_role = 'admin'
    )
  UNION
  SELECT uca.client_id FROM user_client_access uca
  WHERE uca.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = p_user_id AND global_role = 'admin'
    );
$$;
```

---

## PARTE 2 — EDGE FUNCTION: Estender bootstrap-user-access

O `bootstrap-user-access` existente (Fase 7.1) deve ser estendido para TAMBÉM criar `user_profiles` se não existir.

**Arquivo:** `supabase/functions/bootstrap-user-access/index.ts`

Adicionar ANTES da lógica de `user_client_access`:

```typescript
// Ensure user_profiles exists
const { data: profile } = await supaAdmin
  .from('user_profiles')
  .select('id')
  .eq('id', userId)
  .maybeSingle();

if (!profile) {
  const { data: authUser } = await supaAdmin.auth.admin.getUserById(userId);
  await supaAdmin.from('user_profiles').insert({
    id: userId,
    email: authUser?.user?.email ?? null,
    full_name: authUser?.user?.user_metadata?.full_name
      ?? (authUser?.user?.email ? authUser.user.email.split('@')[0] : null),
    global_role: 'viewer',
  });
}
```

Isso garante que novos usuários ganhem perfil automaticamente no primeiro login.

---

## PARTE 3 — DB FUNCTION

### `get_users_with_permissions()`

```sql
CREATE OR REPLACE FUNCTION get_users_with_permissions()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  global_role TEXT,
  active BOOLEAN,
  client_overrides JSONB,
  last_sign_in TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND global_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.email,
    up.full_name,
    up.global_role,
    up.active,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'client_id', uca.client_id,
          'client_name', c.name,
          'role', uca.role
        )
      ) FILTER (WHERE uca.client_id IS NOT NULL),
      '[]'::jsonb
    ) AS client_overrides,
    u.last_sign_in_at
  FROM user_profiles up
  LEFT JOIN user_client_access uca ON uca.user_id = up.id
  LEFT JOIN clients c ON c.id = uca.client_id
  LEFT JOIN auth.users u ON u.id = up.id
  GROUP BY up.id, up.email, up.full_name, up.global_role, up.active, u.last_sign_in_at
  ORDER BY up.global_role ASC, up.email ASC;
END;
$$;
```

---

## PARTE 4 — HOOKS

### `src/hooks/useUsers.ts`
```typescript
// useUsers()
queryKey: ['users_with_permissions']
staleTime: 60_000
// RPC: get_users_with_permissions()
```

### `src/hooks/useUserManagement.ts`
```typescript
// useUpdateUserRole() — useMutation
// UPDATE user_profiles SET global_role, updated_at = now() WHERE id = ?
// PROTEÇÃO frontend: não permitir alterar o próprio role (comparar com auth.uid())
// PROTEÇÃO: contar admins antes — se COUNT(admin) = 1 e alvo é esse admin → toast erro
// invalidateQueries(['users_with_permissions'])
// invalidateQueries(['user-role']) — para refletir mudanças no useUserRole global

// useUpdateClientAccess() — useMutation
// UPSERT user_client_access (user_id, client_id, role) ON CONFLICT DO UPDATE
// invalidateQueries(['users_with_permissions'])

// useRemoveClientAccess() — useMutation
// DELETE FROM user_client_access WHERE user_id AND client_id
// invalidateQueries(['users_with_permissions'])

// useToggleUserActive() — useMutation
// UPDATE user_profiles SET active = NOT active WHERE id = ?
// PROTEÇÃO: não desativar o próprio usuário
// invalidateQueries(['users_with_permissions'])
```

---

## PARTE 5 — FRONTEND

### 5.1 Atualizar `useUserRole.ts`

Atualizar para ler de `user_profiles.global_role` com fallback para lógica anterior:

```typescript
export type UserRole = "admin" | "analyst" | "viewer";

export function useUserRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<{ role: UserRole; isAdmin: boolean; isAnalyst: boolean }> => {
      if (!user?.id) return { role: "viewer", isAdmin: false, isAnalyst: false };

      // Tentar ler de user_profiles primeiro
      const { data: profile, error: profileErr } = await supabase
        .from("user_profiles")
        .select("global_role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileErr && profile) {
        const role = (profile.global_role as UserRole) ?? "viewer";
        return { role, isAdmin: role === "admin", isAnalyst: role === "analyst" };
      }

      // Fallback: lógica anterior via user_client_access
      const { data: rows, error } = await supabase
        .from("user_client_access")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      const isAdmin = (rows ?? []).some((r) => r.role === "admin");
      return { role: isAdmin ? "admin" : "viewer", isAdmin, isAnalyst: false };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    role: data?.role ?? "viewer",
    isAdmin: data?.isAdmin ?? false,
    isAnalyst: data?.isAnalyst ?? false,
    isLoading,
  };
}
```

### 5.2 Nova aba "Usuários" em SettingsPage

Adicionar `{isAdmin && <TabsTrigger value="users">Usuários</TabsTrigger>}` junto às outras tabs admin.

Renderizar `<UserManagementTab />` no `<TabsContent value="users">`.

### 5.3 Componente `UserManagementTab.tsx`

Novo arquivo: `src/components/settings/UserManagementTab.tsx`

**Header:**
- Título "Gerenciamento de Usuários"
- Contagem: "X usuários ativos"
- Input de busca (filtro local, debounce 300ms)

**Tabela:**
| Coluna | Conteúdo |
|--------|----------|
| Usuário | Avatar (inicial) + nome + email |
| Role Global | Select inline: admin / analyst / viewer (desabilitado para o próprio user) |
| Clientes | Contagem de overrides + botão "Gerenciar" |
| Último acesso | Data relativa (ptBR) |
| Status | Switch ativo/inativo (desabilitado para o próprio user) |

**Badges de role:** admin = roxo (`bg-purple-50 text-purple-600`), analyst = azul (`bg-blue-50 text-blue-600`), viewer = slate (`bg-slate-100 text-slate-600`)

**Regras:**
- Select de role e toggle de status DESABILITADOS para o próprio user (tooltip "Você não pode alterar seu próprio acesso")
- Último admin: ao tentar rebaixar, toast "Não é possível remover o último admin"

### 5.4 Sheet `UserPermissionsSheet.tsx`

Novo arquivo: `src/components/settings/UserPermissionsSheet.tsx`

Aberto ao clicar "Gerenciar" na tabela.

**Header:** Nome + email + badge role global

**Seção informativa:**
- Se admin: callout "Este usuário tem acesso admin a todos os clientes automaticamente."
- Se não admin: callout "Role padrão: [role]. Clientes sem override herdam este role."

**Lista de clientes ativos:**
- Nome + badge tier
- Select: "Herdar global ([role])" / "viewer" / "analyst" / "Sem acesso"
- "Herdar global" = default (sem registro em `user_client_access`)
- "Sem acesso" = DELETE do registro
- Outros = UPSERT em `user_client_access`
- Busca local por nome
- Salvar no onChange (sem botão Salvar — toast feedback)

---

## ESCOPO DE ARQUIVOS

| Arquivo | Ação |
|---|---|
| Nova migration | user_profiles + backfill + RLS + indexes |
| Nova migration | CREATE OR REPLACE user_accessible_client_ids + get_users_with_permissions |
| `supabase/functions/bootstrap-user-access/index.ts` | Modificar — criar user_profiles no primeiro login |
| `src/hooks/useUserRole.ts` | Modificar — ler de user_profiles com fallback |
| `src/hooks/useUsers.ts` | Novo — query get_users_with_permissions |
| `src/hooks/useUserManagement.ts` | Novo — mutations role/access/active |
| `src/components/settings/UserManagementTab.tsx` | Novo — tabela de usuários |
| `src/components/settings/UserPermissionsSheet.tsx` | Novo — permissões por cliente |
| `src/pages/SettingsPage.tsx` | Modificar — adicionar aba "Usuários" |

---

## VERIFICAÇÃO PÓS-DEPLOY

**SQL (Operador executa):**
```sql
-- 1. user_profiles criada com backfill
SELECT COUNT(*) FROM user_profiles;
-- Esperado: >= número de usuários em auth.users

-- 2. RLS ativo
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'user_profiles';
-- Esperado: rowsecurity = true

-- 3. DB function
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_users_with_permissions';

-- 4. Promover admin (EXECUTAR MANUALMENTE):
UPDATE user_profiles SET global_role = 'admin'
WHERE email = '<email_do_operador>';
```

**Funcional (11 itens):**
1. Configurações → aba "Usuários" aparece apenas para admin?
2. Tabela lista todos os usuários com role, último acesso e status?
3. Alterar role de outro usuário → toast de confirmação?
4. Tentar alterar o próprio role → campo desabilitado com tooltip?
5. Tentar remover o último admin → toast de erro bloqueando?
6. Clicar "Gerenciar" → Sheet abre com lista de clientes?
7. Override por cliente: setar "analyst" para um cliente → salvo sem botão?
8. "Sem acesso" → remove o registro e usuário não vê mais o cliente?
9. "Herdar global" → remove override e herda role padrão?
10. Admin global: callout "acesso a todos os clientes" aparece no Sheet?
11. Desativar usuário → AlertDialog + switch reflete estado?

**AÇÃO MANUAL DO OPERADOR após deploy:**
```sql
UPDATE user_profiles SET global_role = 'admin'
WHERE email = '<seu_email>';
```

Reportar ao Operador: os 11 itens passaram?
