## S8-A — Correções críticas de segurança (RLS e acesso cross-cliente)

Aplicar exatamente o pacote especificado no prompt, sem desvios.

### 1. Migration única com 5 correções SQL

Criar migration contendo, na ordem:

1. **`get_cx_analytics_metrics`** — recriar com filtro `AND d.client_id IN (SELECT * FROM user_accessible_client_ids(auth.uid()))` na CTE `base`. Manter assinatura, retorno e `SECURITY DEFINER SET search_path = public`.
2. **`get_client_conversations_with_status`** — recriar adicionando `AND p_client_id IN (SELECT * FROM user_accessible_client_ids(auth.uid()))` no WHERE. Manter `GRANT EXECUTE ... TO authenticated`.
3. **`deactivate_stale_clients`** — adicionar `IF NOT is_admin() THEN RAISE EXCEPTION ... USING ERRCODE='insufficient_privilege'` como primeira instrução do bloco; lógica restante inalterada.
4. **Storage `client-documents`** — `DROP POLICY IF EXISTS` para `client_docs_upload`, `client_docs_read`, `client_docs_delete`; recriar as 3 com filtro `split_part(name, '/', 1)::uuid IN (SELECT * FROM user_accessible_client_ids(auth.uid()))` e `auth.role() = 'authenticated'`.

SQL é copiado literalmente do prompt.

### 2. Edge function `summarize-conversation`

No `supabase/functions/summarize-conversation/index.ts`, inserir bloco de validação imediatamente após o parse do body e antes de instanciar `adminClient`:

```ts
const { data: demandCheck, error: demandAccessErr } = await userClient
  .from("demands").select("id").eq("id", demand_id).single();
if (demandAccessErr || !demandCheck) {
  return new Response(JSON.stringify({ error: "Access denied or demand not found" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

### 3. Hook `useClientDocuments.ts`

Já verificado: `useUploadDocument` (linha 137) usa `${clientId}/${timestamp}_${file.name}` — formato compatível com a nova policy. **Nenhuma alteração necessária**.

### Fora do escopo

- Não alterar assinaturas, `SECURITY DEFINER`, demais tabelas, `CONTEXT.md`/`AGENTS.md`/`CLAUDE.md`.
- Não tocar em outros uploads/policies além das 3 do bucket `client-documents`.

### Verificação pós-deploy

Rodar as 8 queries da seção "Verificação pós-deploy" do prompt para confirmar filtros, guard de admin e existência das 3 policies recriadas.
