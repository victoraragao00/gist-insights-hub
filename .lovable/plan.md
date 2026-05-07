## Hotfix CTX1 — RLS em `get_cx_analytics_metrics`

Migration única que recria a função com o filtro `user_accessible_client_ids(auth.uid())` no CTE `base`, fechando o vazamento cross-cliente quando `p_client_id IS NULL`.

### Mudanças

1. **Nova migration** em `supabase/migrations/` aplicando `CREATE OR REPLACE FUNCTION public.get_cx_analytics_metrics(...)` com o SQL exato fornecido no prompt.
2. **`COMMENT ON FUNCTION`** documentando o filtro RLS e o comportamento de admins/`bypass_client_access`.

### Garantias

- Assinatura preservada: `(p_period_days INT DEFAULT 30, p_client_id UUID DEFAULT NULL) RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public`.
- Shape do JSON inalterado (frontend `useCxAnalytics.ts` continua compatível, incluindo `reopen_count` adicionado client-side).
- Apenas o `WHERE` do CTE `base` muda — adiciona `AND d.client_id IN (SELECT * FROM public.user_accessible_client_ids(auth.uid()))` e o guard `IF auth.uid() IS NULL THEN RAISE`.
- Nenhuma outra função (`get_demand_analytics`, `get_tech_dashboard_metrics`, `user_accessible_client_ids`, `is_admin`) é tocada.
- Nenhum arquivo de frontend, `src/integrations/supabase/types.ts` ou `supabase/config.toml` é alterado.

### Verificação pós-deploy

Executar no SQL Editor as 5 queries da seção "Verificação" do prompt (smoke test, isolamento viewer, paridade admin, `p_client_id` específico acessível/não acessível, sanity check de funções vizinhas) e colar resultados na thread.
