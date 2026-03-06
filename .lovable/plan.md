

## Correções: Auto-chain + Ingestão Incremental

### Mudança 1 — Auto-chain no `process-jobs`

No bloco `has_more` (linha 614-620), após o UPDATE para `status='pending'`, disparar um `fetch` fire-and-forget para `process-jobs` antes de retornar a resposta. Sequência garantida:

```text
UPDATE status='pending' (await) → fetch process-jobs (no await) → return Response
```

O fetch não usa `await` — é fire-and-forget. O novo worker vai chamar `claim_next_job()` normalmente e só pega o job se o UPDATE já commitou (o que é garantido pelo `await` anterior). O `pg_cron` continua como safety net.

Adicionar ao final do bloco `has_more`:

```typescript
} else if (result.has_more) {
  await supaAdmin.from('sync_jobs').update({
    status: 'pending', heartbeat_at: null, progress: result.progress,
  }).eq('id', job.id);

  // Auto-chain: trigger next batch immediately (fire-and-forget)
  const selfUrl = `${supabaseUrl}/functions/v1/process-jobs`;
  fetch(selfUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
    body: JSON.stringify({}),
  }).catch(() => {}); // ignore errors, pg_cron is the safety net
}
```

### Mudança 2 — Ingestão incremental (`since_timestamp`)

**Job creators** (`sync-gist-contacts` e `ingest-gist-historical`): antes de inserir o job, consultar o último job `completed` do mesmo tipo e copiar `completed_at` para `payload.since_timestamp`.

```typescript
const { data: lastJob } = await supaAdmin
  .from('sync_jobs')
  .select('completed_at')
  .eq('type', 'ingest_historical') // ou 'sync_contacts'
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(1)
  .single();

if (lastJob?.completed_at) {
  payload.since_timestamp = lastJob.completed_at;
}
```

**Handler `handleIngestHistorical`**: ler `since_timestamp` do payload, converter para Unix timestamp. No loop de conversas, após receber a página, checar cada conversa. Como Gist retorna ordenado por `updated_at DESC`, ao encontrar uma conversa com `updated_at < sinceUnix`, fazer **break do loop externo** (não skip):

```typescript
const sinceTs = (job.payload as any)?.since_timestamp;
const sinceUnix = sinceTs ? Math.floor(new Date(sinceTs).getTime() / 1000) : 0;

// Inside the conversations loop:
let reachedOldData = false;
for (const convo of conversations) {
  if (sinceUnix > 0 && convo.updated_at < sinceUnix) {
    reachedOldData = true;
    break;  // all remaining convos are older — stop entirely
  }
  // ... process convo
}
if (reachedOldData) break;  // break outer pagination loop too
```

**Handler `handleSyncContacts`**: mesma lógica mas usando `contact.last_seen_at`. Contacts são ordenados por `last_seen_at DESC`, então ao encontrar um contato mais antigo que `sinceUnix`, break do loop externo.

### Mudança 3 — Fix orphan retry_count

O código atual chama `supaAdmin.rpc('increment_retry')` que não existe. Substituir por um update direto que lê o retry_count atual:

```typescript
for (const o of orphans) {
  await supaAdmin.from('sync_jobs')
    .update({ retry_count: (o.retry_count ?? 0) + 1 })
    .eq('id', o.id);
}
```

Para isso, o select de orphans precisa incluir `retry_count`:
```typescript
const { data: orphans } = await supaAdmin
  .from('sync_jobs')
  .update({ status: 'pending' })
  .eq('status', 'running')
  .lt('heartbeat_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
  .select('id, retry_count');
```

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/process-jobs/index.ts` | Auto-chain, since_timestamp nos handlers, fix orphan retry |
| `supabase/functions/sync-gist-contacts/index.ts` | Consultar último job completed, salvar since_timestamp |
| `supabase/functions/ingest-gist-historical/index.ts` | Consultar último job completed, salvar since_timestamp |

