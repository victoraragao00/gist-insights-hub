## S8-B — CORS seguro + índices de performance em `user_client_access`

### 1. Migration de índices

Migration única, idempotente, em `user_client_access`:

```sql
CREATE INDEX IF NOT EXISTS idx_user_client_access_user_id   ON public.user_client_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_client_access_client_id ON public.user_client_access(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_client_access_unique ON public.user_client_access(user_id, client_id);
```

### 2. CORS hardening em edge functions

Substituir nas funções autenticadas:

```ts
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN");
if (!ALLOWED_ORIGIN) console.error("[SECURITY] ALLOWED_ORIGIN env var not configured");
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

E após o handler `OPTIONS`, retornar 500 explícito se a env var estiver ausente.

**Funções a alterar (12 das 15 listadas existem e usam `ALLOWED_ORIGIN`):**
`analyze-demand`, `bootstrap-user-access`, `calculate-priority-scores`, `evaluate-audit-rules`, `gist-confirm-mapping`, `gist-discover`, `gist-proxy`, `ingest-gist-historical`, `process-jobs`, `process-meeting-transcription`, `summarize-conversation`, `test-classify`.

**Discrepâncias com o prompt (informar ao final):**
- `trigger-process-jobs` e `update-demand-analytics` não existem no repo — pulados.
- `auth-email-hook` está na lista mas não usa `ALLOWED_ORIGIN` — pulado.
- 3 funções fora da lista também usam `ALLOWED_ORIGIN` com o mesmo padrão vulnerável: `schedule-sync`, `invite-user`, `sync-gist-contacts`. Aplicar o mesmo hardening nelas (mesma vulnerabilidade, mesmo fix), por consistência e segurança.

### 3. `client-demands-public`

Manter `"*"` explícito com comentário documentando intencionalidade; remover qualquer leitura de `Deno.env.get("ALLOWED_ORIGIN")`.

```ts
// Endpoint público: serve página de demandas sem autenticação.
// CORS aberto é intencional — acessado de domínios de clientes externos.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

### Fora do escopo

- Não tocar JWT/auth, lógica de negócio, ou outras tabelas/RLS.
- Não alterar `CONTEXT.md`/`AGENTS.md`/`CLAUDE.md`.
- Configuração da env var `ALLOWED_ORIGIN` no painel: responsabilidade do operador (alertar ao final).
