# Prompt Lovable — Fix SEC1/SEC2: JWT + CORS em gist-discover e gist-proxy

> Repositorio: https://github.com/HyTrackWater/gist-insights-hub
> Prioridade: CRITICA
> Dependencias: Nenhuma
> Auditoria ref: auditorias/AUDITORIA_20260322_1500.md (SEC1, SEC2, SEC3)

---

## OBRIGATORIO

1. Adicionar validacao JWT em `gist-discover/index.ts` e `gist-proxy/index.ts` usando o mesmo padrao de `bootstrap-user-access/index.ts`:
   ```typescript
   const authHeader = req.headers.get('Authorization');
   if (!authHeader) {
     return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
       status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
   const token = authHeader.replace('Bearer ', '');
   const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
   const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
   const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
   const supabase = createClient(supabaseUrl, supabaseAnonKey, {
     global: { headers: { Authorization: `Bearer ${token}` } },
   });
   const { data: { user }, error: authError } = await supabase.auth.getUser();
   if (authError || !user) {
     return new Response(JSON.stringify({ error: 'Unauthorized' }), {
       status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
   ```

2. Restringir CORS origin em ambas as funcoes. Substituir:
   ```typescript
   'Access-Control-Allow-Origin': '*',
   ```
   por:
   ```typescript
   'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
   ```

3. Em `gist-proxy/index.ts`, sanitizar `params` antes de construir URLSearchParams. Apos a linha `const { endpoint, params } = await req.json();`, adicionar:
   ```typescript
   // Sanitize params — only allow string values
   const safeParams: Record<string, string> = {};
   if (params && typeof params === 'object') {
     for (const [k, v] of Object.entries(params)) {
       if (typeof v === 'string' || typeof v === 'number') {
         safeParams[String(k)] = String(v);
       }
     }
   }
   ```
   E usar `safeParams` em vez de `params` no `new URLSearchParams(safeParams)`.

---

## PROIBIDO

1. NAO remover a whitelist de endpoints (`ALLOWED_ENDPOINTS`) em gist-proxy
2. NAO alterar a logica de negocio (agrupamento, matching, fetch Gist) — apenas adicionar auth e sanitizacao
3. NAO alterar outras Edge Functions
4. NAO tomar decisoes autonomas — se algo parecer errado, reportar ao Operador

---

## Problema

`gist-discover` e `gist-proxy` sao Edge Functions que usam `GIST_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` internamente, mas nao validam quem esta chamando. Combinado com `Access-Control-Allow-Origin: *`, qualquer pessoa pode chamar essas funcoes e consumir a API do Gist ou acessar dados do Supabase via service_role.

**Risco:** Acesso nao autorizado a dados de contatos/conversas do Gist e potencial abuso da API key.

---

## Verificacao pos-deploy

```bash
# Deve retornar 401
curl -s -w "%{http_code}" -o /dev/null \
  https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/gist-discover

# Deve retornar 401
curl -s -w "%{http_code}" -o /dev/null \
  -X POST https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/gist-proxy \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"contacts","params":{}}'

# Com JWT valido deve funcionar normalmente
curl -s -w "%{http_code}" \
  https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/gist-discover \
  -H "Authorization: Bearer <JWT_VALIDO>"
```

---

## Checklist CTO aplicavel

- [x] m8: Erros Supabase tratados (auth.getUser error handling)
- [x] Credenciais com menor privilegio (JWT antes de service_role)
- [x] Logs nao exibem dados sensiveis
