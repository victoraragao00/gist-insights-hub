# Prompt Lovable — Fix: Bootstrap não invalida queries após conceder acesso

> **Severidade:** Alto — novo usuário precisa dar F5 manualmente para ver dados após primeiro login
> **Origem:** Auditoria Claude Code (2026-03-19)

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

---

## OBRIGATÓRIO

- Editar APENAS o arquivo listado no escopo
- Manter o comportamento fire-and-forget (não bloquear renderização)
- Após bootstrap bem-sucedido, invalidar todas as queries do React Query

## PROIBIDO

- Alterar a Edge Function `bootstrap-user-access`
- Alterar a migration do trigger `on_client_created`
- Criar arquivos novos
- Reverter código existente

---

## Problema

`src/components/ProtectedRoute.tsx` chama `bootstrap-user-access` no primeiro login, mas tem dois bugs:

### Bug 1 — Sem `invalidateQueries` após bootstrap

Quando o bootstrap insere os registros em `user_client_access`, as queries do React Query já rodaram e cachearam resultados vazios. Sem `invalidateQueries()`, o usuário vê tudo vazio até recarregar a página manualmente.

### Bug 2 — Flag setada antes do resultado

A flag `sessionStorage.setItem(BOOTSTRAP_KEY, "1")` é setada ANTES da chamada à Edge Function. Se a função falhar (rede, timeout, etc.), a flag já está lá e o bootstrap não retenta na próxima navegação.

---

## Código atual

```tsx
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const BOOTSTRAP_KEY = "bootstrap-user-access-done";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(BOOTSTRAP_KEY)) return;

    sessionStorage.setItem(BOOTSTRAP_KEY, "1");  // ← Bug 2: setado antes do resultado

    supabase.functions
      .invoke("bootstrap-user-access")
      .catch(() => {
        // fire-and-forget — don't block the user  // ← Bug 1: sem invalidateQueries
      });
  }, [user]);
  // ...
}
```

---

## Fix

```tsx
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const BOOTSTRAP_KEY = "bootstrap-user-access-done";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(BOOTSTRAP_KEY)) return;

    supabase.functions
      .invoke("bootstrap-user-access")
      .then(({ data }) => {
        sessionStorage.setItem(BOOTSTRAP_KEY, "1");
        if (data?.bootstrapped) {
          queryClient.invalidateQueries();
        }
      })
      .catch(() => {
        // Don't set flag — retries on next navigation
      });
  }, [user, queryClient]);

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

### Mudanças:

1. **Adicionar import** `useQueryClient` de `@tanstack/react-query`
2. **Adicionar** `const queryClient = useQueryClient()` no componente
3. **Mover** `sessionStorage.setItem` para dentro do `.then()` — só seta flag após sucesso
4. **Adicionar** `queryClient.invalidateQueries()` quando `data.bootstrapped === true` — força refetch de todas as queries
5. **No `.catch()`** — NÃO setar flag, permitindo retry na próxima navegação
6. **Adicionar** `queryClient` nas dependências do `useEffect`

---

## Escopo de arquivos

| Arquivo | Ação |
|---|---|
| `src/components/ProtectedRoute.tsx` | Corrigir useEffect do bootstrap |

---

## Verificação

1. Novo usuário faz signup → login → dados aparecem SEM precisar dar F5
2. Recarregar a página → bootstrap NÃO é chamado novamente (flag no sessionStorage)
3. Simular erro de rede (DevTools offline) → recarregar → bootstrap retenta (flag não foi setada)
4. Usuário existente com acesso → bootstrap retorna `already_has_access` → flag setada, sem invalidateQueries
5. Console sem erros relacionados a bootstrap
