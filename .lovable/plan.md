

## Auditoria Completa — CX Hub uMode (2026-04-14)

### Metodologia

Auditoria contra: AGENTS.md (Checklist CTO m1-m13, anti-padroes, IA stack), CLAUDE.md (regras criticas), PRD (principio "IA stack: Gemini + fallback Claude, nunca OpenAI"), e a instrucao explicita do usuario de que **Lovable AI Gateway e PROIBIDO**.

---

### CRITICO — Uso proibido do Lovable AI Gateway

3 Edge Functions usam `https://ai.gateway.lovable.dev` + `LOVABLE_API_KEY` em vez de Gemini API diretamente via `GEMINI_API_KEY` (com fallback `CLAUDE_API_KEY`):

| Arquivo | Uso atual | Correção |
|---------|-----------|----------|
| `supabase/functions/summarize-conversation/index.ts` | Lovable AI Gateway (`google/gemini-2.5-flash`) | Migrar para `generativelanguage.googleapis.com` com `GEMINI_API_KEY` |
| `supabase/functions/analyze-demand/index.ts` | Lovable AI Gateway (`google/gemini-2.5-flash`) | Migrar para `generativelanguage.googleapis.com` com `GEMINI_API_KEY` |
| `supabase/functions/process-meeting-transcription/index.ts` | Lovable AI Gateway (`google/gemini-2.5-flash`) | Migrar para `generativelanguage.googleapis.com` com `GEMINI_API_KEY` |

**Nota:** `auth-email-hook/index.ts` usa `LOVABLE_API_KEY` para autenticacao de webhook (nao para IA) — este uso e aceitavel e nao sera alterado.

**Nota:** `process-jobs/index.ts` (classify-batch) ja usa `GEMINI_API_KEY` corretamente — e o padrao a seguir.

---

### MEDIO — Violacoes do Checklist CTO (m1)

**`as any` residuais (36 ocorrencias em 4 arquivos):**

| Arquivo | Ocorrencias | Justificativa |
|---------|-------------|---------------|
| `ColumnSettingsTab.tsx` | 3x `(column as any).triggers_sla_response_at` | Tipo `triggers_sla_response_at` ausente no types.ts auto-gerado — aguarda regeneracao |
| `DemandDetailSheet.tsx` | 4x `(demand as any).resolution` | Campo `resolution` ausente no tipo auto-gerado |
| `CreateDemandDialog.tsx` | 1x `(data as any)?.id` | Tipo de retorno de mutation nao tipado |
| `useClientConversationsStatus.ts` | 1x `as any` em RPC name | RPC nao reconhecida pelo tipo auto-gerado |

**`as never` residuais (27 ocorrencias em 4 arquivos):**

| Arquivo | Causa |
|---------|-------|
| `useUsers.ts` | RPC `get_users_with_permissions` nao tipada |
| `useUserRole.ts` | Tabela `user_profiles` nao no tipo auto-gerado |
| `useUserManagement.ts` | Idem |
| `AgendaSettingsTab.tsx` | Cast duplo para contornar tipo de `value` |

**Diagnostico:** A maioria destes `as any`/`as never` existe porque o `types.ts` auto-gerado nao inclui tabelas/RPCs recentes. A solucao e regenerar os tipos — nao corrigir manualmente.

---

### BAIXO — Conformidade OK

| Item | Status |
|------|--------|
| m2: ErrorBoundary em toda rota | OK — todas as 10 rotas protegidas |
| m3: Toast unico (sonner) | OK |
| m4: staleTime > 0 | OK (verificado em hooks principais) |
| m8: Erros Supabase tratados | OK nas 3 edge functions |
| m11: Zero imports nao usados | OK (corrigido em DT-1) |
| m12: Paginacao | OK (InteractionsFeed com .limit(500)) |

---

### Plano de Correcoes

#### 1. Migrar 3 Edge Functions de Lovable AI Gateway para Gemini API direta (CRITICO)

Seguir o padrao ja usado em `process-jobs/index.ts` (classify-batch):

```text
Antes:
  fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: { model: "google/gemini-2.5-flash", messages: [...] }
  })

Depois:
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    body: { contents: [...], generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } }
  })
```

Cada funcao recebera:
- Substituicao do endpoint e formato de request/response (OpenAI format → Gemini format)
- Fallback para `CLAUDE_API_KEY` via `https://api.anthropic.com/v1/messages` caso `GEMINI_API_KEY` falhe
- Remocao de toda referencia a `LOVABLE_API_KEY` (exceto `auth-email-hook`)

**Arquivos editados:**
- `supabase/functions/summarize-conversation/index.ts`
- `supabase/functions/analyze-demand/index.ts`
- `supabase/functions/process-meeting-transcription/index.ts`

#### 2. Regenerar tipos Supabase (MEDIO)

Apos a correcao das edge functions, solicitar regeneracao do `types.ts` para eliminar os `as any`/`as never` residuais. Isso resolvera os casts em `ColumnSettingsTab`, `DemandDetailSheet`, `useUserRole`, etc.

**Nenhum arquivo editado manualmente** — depende de regeneracao automatica.

### Nenhuma alteracao em

- Migrations, RLS, `.env`, `src/integrations/supabase/*`, frontend (alem do que depende da regeneracao de tipos)
- `auth-email-hook/index.ts` (uso de `LOVABLE_API_KEY` e para autenticacao de webhook, nao IA)

