# Prompt Lovable — Fix: Onboarding User Access (Triggers + Edge Function + Backfill)

> **Severidade:** Crítico — bloqueia 100% da experiência para qualquer novo usuário
> **Origem:** Teste com novo usuário (2026-03-19)

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

---

## OBRIGATÓRIO

- Zero hardcode — nenhum UUID, email ou valor fixo no código
- Seguir Playbook de Engenharia uMode (modularidade, clean code, segurança)
- Manter RLS intacto — não desabilitar, não criar bypass
- Novo usuário deve ter role `'viewer'` por default
- Promoção para `'admin'` continua sendo manual (Operador faz UPDATE no Supabase)
- Edge Function modular: handler separado de lógica
- `ON CONFLICT DO NOTHING` em toda inserção (idempotência)

## PROIBIDO

- Hardcodar UUIDs, emails ou qualquer identificador de usuário
- Alterar tabelas existentes (clients, interactions, demands, etc.)
- Alterar RLS policies existentes
- Alterar a função `user_accessible_client_ids()`
- Dar role `'admin'` automaticamente
- Criar trigger diretamente em `auth.users` (schema reservado do Supabase — não permitido)
- Alterar SignupPage ou LoginPage

---

## Problema

Quando um novo usuário faz signup, `supabase.auth.signUp()` cria o registro em `auth.users`, mas **nenhum registro é inserido em `user_client_access`**.

Consequência:
- `user_accessible_client_ids(auth.uid())` retorna conjunto vazio
- RLS filtra TUDO — o usuário não vê nenhum client, interaction, demand, score, alerta
- O app renderiza normalmente mas todas as listas estão vazias — parece quebrado

**Tabela chave:** `user_client_access` — contém `user_id`, `client_id`, `role`
**Função chave:** `user_accessible_client_ids(uid)` — retorna `SETOF uuid` dos client_ids que o user pode ver

**Restrição técnica:** Não é possível criar trigger em `auth.users` (schema reservado do Supabase). A solução usa Edge Function chamada no primeiro login autenticado.

---

## Fix — 3 partes

### Parte A — Migration: Trigger `on_client_created`

Quando o sync (ou qualquer processo) cria um novo client, todos os usuários existentes ganham acesso viewer automaticamente.

```sql
CREATE OR REPLACE FUNCTION public.grant_new_client_to_all_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_client_access (user_id, client_id, role)
  SELECT au.id, NEW.id, 'viewer'
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM user_client_access uca
    WHERE uca.user_id = au.id AND uca.client_id = NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_new_client_to_all_users();
```

**Na mesma migration**, executar o backfill para usuários existentes que têm 0 registros:

```sql
INSERT INTO public.user_client_access (user_id, client_id, role)
SELECT au.id, c.id, 'viewer'
FROM auth.users au
CROSS JOIN public.clients c
WHERE c.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_client_access uca
    WHERE uca.user_id = au.id AND uca.client_id = c.id
  )
ON CONFLICT DO NOTHING;
```

**IMPORTANTE:** O backfill NÃO altera registros existentes. Usuários que já têm acesso configurado (ex: admin com clientes específicos) não são afetados — o `NOT EXISTS` + `ON CONFLICT DO NOTHING` garantem idempotência.

### Parte B — Edge Function: `bootstrap-user-access`

Chamada no primeiro login autenticado. Verifica se o usuário tem 0 registros em `user_client_access` e, se sim, insere viewer para todos os clients ativos.

**Arquivo:** `supabase/functions/bootstrap-user-access/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client — to get authenticated user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client — to bypass RLS for insert
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already has access
    const { count, error: countError } = await serviceClient
      .from("user_client_access")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return new Response(
        JSON.stringify({ bootstrapped: false, reason: "already_has_access", count }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active clients
    const { data: clients, error: clientsError } = await serviceClient
      .from("clients")
      .select("id")
      .eq("active", true);

    if (clientsError) throw clientsError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ bootstrapped: false, reason: "no_active_clients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert viewer access for all active clients
    const rows = clients.map((c) => ({
      user_id: user.id,
      client_id: c.id,
      role: "viewer",
    }));

    const { error: insertError } = await serviceClient
      .from("user_client_access")
      .insert(rows)
      .select();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ bootstrapped: true, clients_granted: rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Parte C — Frontend: Auto-bootstrap no `ProtectedRoute`

Após autenticação confirmada, chamar `bootstrap-user-access` uma vez por sessão. Usar `sessionStorage` para evitar chamadas repetidas.

**Arquivo:** `src/components/ProtectedRoute.tsx`

Código atual:
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

Código novo — adicionar `useEffect` para bootstrap:
```tsx
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const BOOTSTRAP_KEY = "user_access_bootstrapped";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    if (sessionStorage.getItem(BOOTSTRAP_KEY)) return;

    sessionStorage.setItem(BOOTSTRAP_KEY, "pending");

    supabase.functions
      .invoke("bootstrap-user-access")
      .then(({ data }) => {
        sessionStorage.setItem(BOOTSTRAP_KEY, "done");
        if (data?.bootstrapped) {
          // New access granted — invalidate all queries so data appears
          queryClient.invalidateQueries();
        }
      })
      .catch(() => {
        // Remove flag so it retries next navigation
        sessionStorage.removeItem(BOOTSTRAP_KEY);
      });
  }, [user?.id, queryClient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

**Comportamento:**
- Roda uma vez por sessão (sessionStorage flag)
- Se o user já tem acesso → Edge Function retorna `{ bootstrapped: false }` → noop
- Se o user é novo (0 registros) → insere viewer em todos os clients → `invalidateQueries()` → dados aparecem
- Se falha → remove flag → retenta na próxima navegação
- Fire-and-forget: não bloqueia renderização do Outlet

---

## Escopo de arquivos

| Arquivo | Ação |
|---|---|
| Nova migration | Trigger `on_client_created` + backfill |
| `supabase/functions/bootstrap-user-access/index.ts` | Novo — Edge Function |
| `src/components/ProtectedRoute.tsx` | Modificar — adicionar useEffect bootstrap |

---

## Verificação

1. **Novo usuário:** signup → login → deve ver todos os clients, interactions, demands, scores, alertas imediatamente
2. **SQL check:** `SELECT count(*) FROM user_client_access WHERE user_id = '<novo>'` → deve ter 1 registro por client ativo
3. **Role viewer:** tabs admin em Settings (Colunas, Áreas, Responsáveis, Prioridades) NÃO aparecem
4. **Admin preservado:** usuários existentes com role `'admin'` NÃO são afetados pelo backfill
5. **Idempotência:** recarregar a página várias vezes → Edge Function não duplica registros (sessionStorage + ON CONFLICT)
6. **Novo client via sync:** rodar sync_contacts → novo client aparece para todos os usuários automaticamente (trigger on_client_created)
7. **Console:** sem erros no browser console relacionados a bootstrap
8. **Backfill:** o usuário que estava sem acesso agora vê os dados após a migration rodar
