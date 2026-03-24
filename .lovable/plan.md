
## Fixes: SEC1, SEC2 (JWT + CORS) and AP1 (DELETE sem auto_created)

### Current State

**SEC1 — gist-discover/index.ts**: Sem validação JWT. Qualquer pessoa pode chamar e consumir `GIST_API_KEY` + usar `service_role` para consultar `clients`.

**SEC2 — gist-proxy/index.ts**: Sem validação JWT. `GIST_API_KEY` exposta publicamente. `params` sem sanitização — valores não-string passados diretamente para `URLSearchParams`.

**AP1 — process-jobs/index.ts (linha 380)**: DELETE apaga TODAS as interactions do `client_id` sem filtrar `auto_created`. Risco de perda irreversível de dados manuais.

**config.toml**: `gist-proxy` tem `verify_jwt = false`. `gist-discover` não está listado (já será protegido via código). Nenhuma mudança necessária no toml — JWT será validado em código como já ocorre em `bootstrap-user-access`.

---

### Mudanças Planejadas

**1. `supabase/functions/gist-discover/index.ts`**

Adicionar bloco de auth logo após o check de variáveis de ambiente (antes de qualquer lógica Gist):

```typescript
// Extrair e validar JWT do chamador
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const supaAuth = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: authData, error: authError } = await supaAuth.auth.getUser();
if (authError || !authData.user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

Também adicionar `SUPABASE_ANON_KEY` ao check de variáveis de ambiente.

**2. `supabase/functions/gist-proxy/index.ts`**

Adicionar o mesmo bloco JWT antes do `const { endpoint, params } = await req.json()`.

Substituir `params` por `safeParams` após sanitização:
```typescript
const safeParams: Record<string, string> = {};
if (params && typeof params === 'object') {
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number') {
      safeParams[String(k)] = String(v);
    }
  }
}
```

**3. `supabase/functions/process-jobs/index.ts` (linha 380)**

Alterar apenas a linha de DELETE para adicionar o filtro `auto_created`:

```typescript
// ANTES:
const { error: delErr } = await supaAdmin.from('interactions').delete().eq('client_id', deleteClientId);

// DEPOIS:
const { error: delErr } = await supaAdmin
  .from('interactions')
  .delete()
  .eq('client_id', deleteClientId)
  .eq('metadata->>auto_created', 'true');
```

**4. `supabase/config.toml`**

Adicionar `[functions.gist-discover]` com `verify_jwt = false` para consistência com o padrão do projeto (JWT validado em código, não pelo gateway).

---

### Arquivos alterados
- `supabase/functions/gist-discover/index.ts` — JWT validation
- `supabase/functions/gist-proxy/index.ts` — JWT validation + params sanitization
- `supabase/functions/process-jobs/index.ts` — filtro `auto_created` no DELETE
- `supabase/config.toml` — adicionar entrada `gist-discover`

### Sem alterações em
- Lógica de negócio (agrupamento, matching, fetch Gist)
- Outras Edge Functions
- `ALLOWED_ENDPOINTS` whitelist
- Migrations ou RLS policies
