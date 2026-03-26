# AUDITORIA SA-1 a SA-4 — Módulo de Pautas de Reunião

> Executada por: Claude Code (Agente de Revisão e Engenharia)
> Data: 2026-03-26
> Escopo: SA-1 (tabelas), SA-2 (CRUD), SA-3 (IA + homework → tickets), SA-4 (settings)
> Diff: 523f8ee..a7de1f7 (16 arquivos, +1879 linhas)

---

## Resumo Executivo

| Categoria | Status | Críticos | Médios | Baixos |
|-----------|--------|----------|--------|--------|
| Edge Function (segurança) | ⚠️ | 2 | 2 | 1 |
| Checklist CTO (m1-m13) | ⚠️ | 0 | 2 | 1 |
| Design System | ⚠️ | 0 | 1 | 2 |
| **Total** | **⚠️** | **2** | **5** | **4** |

---

## CRÍTICOS

### C1 — Edge Function sem JWT (process-meeting-transcription)

**Arquivo:** `supabase/functions/process-meeting-transcription/index.ts`

A função NÃO valida o JWT do chamador. Aceita qualquer request e usa `SUPABASE_SERVICE_ROLE_KEY` para escrever no banco. Qualquer pessoa que conheça a URL pode processar transcrições e escrever em `meeting_agendas` e `meeting_homework_items`.

**Fix:** Adicionar validação JWT (mesmo padrão corrigido em gist-discover/gist-proxy):
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const supaAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
  global: { headers: { Authorization: authHeader } },
});
const { data: authData, error: authError } = await supaAuth.auth.getUser();
if (authError || !authData.user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### C2 — CORS wildcard em produção (process-meeting-transcription)

**Arquivo:** `supabase/functions/process-meeting-transcription/index.ts:5`

`Access-Control-Allow-Origin: *` — mesmo problema que foi corrigido em SEC1/SEC2.

**Fix:** `'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*'`

---

## MÉDIOS

### M1 — DELETE sem error handling (process-meeting-transcription)

**Arquivo:** `supabase/functions/process-meeting-transcription/index.ts:~119-123`

O DELETE de homework items anteriores não captura `{ error }`:
```typescript
await supabase
  .from('meeting_homework_items')
  .delete()
  .eq('agenda_id', agenda_id)
  .is('converted_to_demand_id', null)
```

**Fix:** Capturar e tratar o erro:
```typescript
const { error: deleteError } = await supabase
  .from('meeting_homework_items')
  .delete()
  .eq('agenda_id', agenda_id)
  .is('converted_to_demand_id', null);
if (deleteError) throw deleteError;
```

**Nota positiva:** O filtro `.is('converted_to_demand_id', null)` está correto — protege itens já convertidos em ticket. ✅

### M2 — Dados sensíveis em console.log (process-meeting-transcription)

**Arquivo:** `supabase/functions/process-meeting-transcription/index.ts:~95`

`console.error("Gemini returned invalid format:", rawText)` loga a resposta completa do LLM, que pode conter trechos da transcrição (dados de reunião do cliente).

**Fix:** Logar apenas o tamanho: `console.error("Gemini returned invalid format, length:", rawText.length)`

### M3 — `as unknown as` em hooks (m1 — 3 ocorrências)

| Arquivo | Linha | Cast |
|---------|-------|------|
| `src/hooks/useMeetingAgendas.ts` | 49 | `as unknown as MeetingAgendaWithClient[]` |
| `src/hooks/useMeetingAgendas.ts` | 68 | `as unknown as MeetingAgenda \| null` |
| `src/hooks/useMeetingHomework.ts` | 33 | `as unknown as HomeworkItem[]` |

Mesmo padrão das violações m1 anteriores. Acumula com as 7 existentes → total 10.

### M4 — Imports não usados (m11 — 2 ocorrências)

| Arquivo | Import |
|---------|--------|
| `src/pages/AgendasPage.tsx:2` | `useQuery` importado mas não usado (usa hook customizado) |
| `src/components/agendas/CreateAgendaDialog.tsx:2` | `useQuery` importado mas não usado |

---

## BAIXOS

### B1 — SatisfactionPicker cores hardcoded

**Arquivo:** `src/components/agendas/SatisfactionPicker.tsx:7-11`

Cores de satisfação (red, orange, yellow, emerald) hardcoded em vez de usar paleta semântica do Design System.

### B2 — Stagger animation sem classe

**Arquivo:** `src/pages/AgendasPage.tsx:75-76`

`style={{ animationDelay: ..., opacity: 0 }}` mas sem classe `animate-fade-in-up`. Items ficam invisíveis.

### B3 — AgendaSettingsTab `as never` cast

**Arquivo:** `src/components/settings/AgendaSettingsTab.tsx:46`

`.update({ value: config as unknown as Record<string, string>, updated_at: ... } as never)` — double cast para contornar tipagem Supabase.

### B4 — `id=` em RadioGroupItem

**Arquivo:** `src/components/settings/AgendaSettingsTab.tsx:98`

`id={${field}-${opt.value}}` é DOM ID estático, mas neste caso é necessário para o `htmlFor` do Label. Aceitável como exceção (padrão de acessibilidade).

---

## PASS (sem violações)

| Item | Status |
|------|--------|
| m2: ErrorBoundary em /agendas | ✅ App.tsx wraps com ErrorBoundary |
| m3: Toast via sonner | ✅ Todos usam `toast` de sonner |
| m4: staleTime > 0 | ✅ 5min em todas as queries |
| m5: queryKeys completos | ✅ Incluem user?.id + dependencies |
| m7: Guard duplo clique | ✅ isPending + disabled em todos os botões |
| m8: Erros Supabase (hooks) | ✅ Todos tratam { data, error } |
| m9: useMutation para escrita | ✅ Todas as operações |
| m10: refetch() | ✅ Usa invalidateQueries |
| Migration: RLS | ✅ user_accessible_client_ids() em todas |
| Migration: Indexes | ✅ 4 indexes criados |
| Migration: Trigger | ✅ update_meeting_agenda_updated_at |
| Migration: Seed ON CONFLICT | ✅ DO NOTHING |
| Edge Function: Gemini (não OpenAI) | ✅ gemini-2.0-flash |
| Edge Function: DELETE protege convertidos | ✅ .is('converted_to_demand_id', null) |
| SA-4: useMutation | ✅ saveMutation com isPending guard |
| SA-4: sonner toast | ✅ |
| SA-4: Supabase error handling | ✅ |
| Dark mode | ✅ Variantes presentes |

---

## Plano de Ação

### Prompt Lovable necessário (Críticos + Médios da Edge Function)

1. **C1:** Adicionar JWT validation
2. **C2:** CORS via ALLOWED_ORIGIN
3. **M1:** Error handling no DELETE
4. **M2:** Remover rawText do console.error

### Podem ser corrigidos em batch futuro (Médios/Baixos de frontend)

5. **M3:** 3x `as unknown as` nos hooks (acumular com batch m1)
6. **M4:** 2x imports não usados
7. **B1-B2:** Design System (SatisfactionPicker + stagger animation)
