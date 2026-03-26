# Prompt Lovable — Fix SA-3: Segurança da Edge Function process-meeting-transcription

> Repositorio: https://github.com/HyTrackWater/gist-insights-hub
> Prioridade: CRITICA
> Dependencias: Nenhuma
> Auditoria ref: auditorias/AUDITORIA_20260326_SA1_SA4.md (C1, C2, M1, M2)

---

## OBRIGATORIO

### 1. Adicionar validacao JWT (C1)

Em `supabase/functions/process-meeting-transcription/index.ts`, ANTES de qualquer logica de negocio (antes de `const { agenda_id, transcription } = await req.json()`), adicionar:

```typescript
// JWT validation — identify the caller before using service_role
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
const supaAuth = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});

const { data: authData, error: authError } = await supaAuth.auth.getUser();
if (authError || !authData.user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Mesmo padrao usado em `gist-discover` e `gist-proxy` (corrigidos em 2026-03-24).

### 2. Restringir CORS (C2)

Substituir:
```typescript
"Access-Control-Allow-Origin": "*",
```
por:
```typescript
"Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') ?? '*',
```

### 3. Error handling no DELETE (M1)

Localizar o DELETE de homework items anteriores e capturar o erro:

**Codigo atual:**
```typescript
await supabase
  .from('meeting_homework_items')
  .delete()
  .eq('agenda_id', agenda_id)
  .is('converted_to_demand_id', null)
```

**Codigo corrigido:**
```typescript
const { error: deleteError } = await supabase
  .from('meeting_homework_items')
  .delete()
  .eq('agenda_id', agenda_id)
  .is('converted_to_demand_id', null);
if (deleteError) throw deleteError;
```

### 4. Remover dados sensiveis do log (M2)

Localizar:
```typescript
console.error("Gemini returned invalid format:", rawText)
```

Substituir por:
```typescript
console.error("Gemini returned invalid format, length:", rawText.length)
```

---

## PROIBIDO

1. NAO alterar a logica de parsing do Gemini (prompt, temperature, model)
2. NAO alterar a estrutura do response JSON
3. NAO alterar o filtro `.is('converted_to_demand_id', null)` no DELETE — ele protege itens ja convertidos
4. NAO alterar outros arquivos
5. NAO tomar decisoes autonomas

---

## Problema

A Edge Function `process-meeting-transcription` foi deployada sem validacao JWT e com CORS aberto. Qualquer pessoa que conheca a URL pode processar transcricoes e escrever no banco via service_role. Mesmo problema corrigido em SEC1/SEC2 na auditoria anterior.

---

## Verificacao pos-deploy

```bash
# Deve retornar 401
curl -s -w "%{http_code}" -o /dev/null \
  -X POST https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/process-meeting-transcription \
  -H "Content-Type: application/json" \
  -d '{"agenda_id":"test","transcription":"test"}'

# Com JWT valido + body invalido deve retornar 400 (input validation)
curl -s -w "%{http_code}" -o /dev/null \
  -X POST https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/process-meeting-transcription \
  -H "Authorization: Bearer <JWT_VALIDO>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Checklist CTO aplicavel

- [x] m8: Erros Supabase tratados (DELETE error handling)
- [x] Credenciais com menor privilegio (JWT antes de service_role)
- [x] Logs nao exibem dados sensiveis (rawText removido)
