

## Diagnóstico — Bugs no Schedule Automático

---

### Bug 1: Crons no banco

Resultado do `SELECT jobname, schedule FROM cron.job`:

| jobname | schedule | Esperado | Status |
|---------|----------|----------|--------|
| `schedule-sync-bh` | `*/5 11-21 * * 1-5` | `*/5 11-21 * * 1-5` | **OK** |
| `process-jobs-fallback` | `*/3 11-22 * * 1-5` | `*/3 11-22 * * 1-5` | **OK** |
| `schedule-sync-eod` | `59 2 * * 2-6` | `59 2 * * 2-6` | **OK** |

Os 3 crons estão com o schedule correto. Nenhuma correção necessária.

---

### Bug 2: Código do `schedule-sync` — análise do `since_timestamp`

O código (linhas 51-65) faz:

```typescript
const { data: lastJob } = await supaAdmin
  .from('sync_jobs')
  .select('completed_at')
  .eq('type', jobType)        // filtra pelo tipo (sync_contacts ou ingest_historical)
  .eq('status', 'completed')  // apenas completed
  .order('completed_at', { ascending: false })
  .limit(1)
  .single();

const payload: Record<string, unknown> = {};
if (lastJob?.completed_at) {
  payload.since_timestamp = lastJob.completed_at;
}
```

**A lógica está correta.** Confirmação pelos dados reais dos últimos jobs:

| Job ID | Tipo | Payload (since_timestamp) | Status |
|--------|------|--------------------------|--------|
| `926c14c8` | sync_contacts | `2026-03-07T00:44:12.517+00:00` | pending |
| `8eff7088` | ingest_historical | `2026-03-07T00:36:01.95+00:00` | pending |
| `25cdea5b` | sync_contacts | `2026-03-07T00:34:01.69+00:00` | completed |
| `e5d8f3da` | ingest_historical | `2026-03-07T00:32:12.336+00:00` | completed |

Os payloads dos jobs pendentes (`926c14c8`, `8eff7088`) contêm `since_timestamp` correto, apontando para o `completed_at` do job anterior completado do mesmo tipo. O `schedule-sync` **não** está fazendo full sync.

---

### Problema real identificado

Os dois jobs manuais (`926c14c8` e `8eff7088`) estão **travados em `pending`** porque foram criados às 01:03 UTC — fora da janela do `process-jobs-fallback` (11-22 UTC). O fire-and-forget do `schedule-sync` disparou o worker, mas esses jobs foram criados manualmente (pelo botão na UI), e as edge functions `sync-gist-contacts` e `ingest-gist-historical` **não disparam o worker `process-jobs`** após criar o job.

Enquanto esses dois jobs ficarem em `pending`, a RPC `create_job_if_none_active` vai retornar `already_running: true` para ambos os tipos, **bloqueando qualquer novo sync automático**.

### Ação necessária

1. **Cancelar os 2 jobs travados** (SQL) para desbloquear a fila
2. **Adicionar fire-and-forget para `process-jobs`** nas edge functions `sync-gist-contacts` e `ingest-gist-historical` — mesmo padrão que `schedule-sync` já usa — para que syncs manuais funcionem em qualquer horário

Isso é o plano que já foi aprovado anteriormente. Confirma para implementar?

