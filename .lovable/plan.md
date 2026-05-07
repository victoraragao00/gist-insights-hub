## Hotfix CTX6 — guard `is_admin()` em `deactivate_stale_clients`

Migration única recriando a função com guard admin-only no início, sem alterar a lógica do `UPDATE`.

### Mudanças

1. Nova migration em `supabase/migrations/` com `CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)` exatamente como no SQL fornecido.
2. Adiciona `IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;` antes do `UPDATE`.
3. `COMMENT ON FUNCTION` documentando que é admin-only.

### Garantias

- Assinatura preservada: `(_days integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
- Filtros do `UPDATE` (`auto_created='true'`, `last_seen_at`, triple `NOT EXISTS`) inalterados.
- `is_admin()` não é tocada.
- Nenhuma outra função, tabela, policy ou RPC alterada.
- `EXECUTE` para `authenticated` permanece (guard interno é a barreira).

### Verificação pós-deploy

Rodar no SQL Editor as 4 queries da seção "Verificação": admin com `_days=99999` (esperar 0), non-admin (esperar `ERROR: Admin only`), conferência de candidatos vs row_count e sanity de `is_admin()`.
