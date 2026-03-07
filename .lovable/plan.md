

## Guarda Atômica contra Duplicatas

A observação está correta. Um SELECT simples seguido de INSERT tem race condition — dois requests simultâneos podem ambos ver "nenhum job ativo" e criar dois jobs.

### Solução: RPC com INSERT ... ON CONFLICT ou CTE atômico

Criar uma database function `create_job_if_none_active` que faz check + insert numa única operação atômica usando `FOR UPDATE SKIP LOCKED`:

```sql
CREATE OR REPLACE FUNCTION public.create_job_if_none_active(
  _type job_type,
  _created_by uuid,
  _payload jsonb DEFAULT '{}'
)
RETURNS TABLE(job_id uuid, already_running boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_id uuid;
  _new_id uuid;
BEGIN
  -- Lock any active job of this type to prevent race condition
  SELECT id INTO _existing_id
  FROM sync_jobs
  WHERE type = _type AND status IN ('pending', 'running')
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _existing_id IS NOT NULL THEN
    job_id := _existing_id;
    already_running := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- No active job found — create one
  INSERT INTO sync_jobs (type, status, created_by, payload, progress)
  VALUES (_type, 'pending', _created_by, _payload, '{}')
  RETURNING id INTO _new_id;

  job_id := _new_id;
  already_running := false;
  RETURN NEXT;
END;
$$;
```

### Mudanças nos Edge Functions

Ambos `ingest-gist-historical/index.ts` e `sync-gist-contacts/index.ts` substituem o bloco SELECT lastJob + INSERT por:

```typescript
// Incremental: get since_timestamp
const { data: lastJob } = await supaAdmin
  .from('sync_jobs')
  .select('completed_at')
  .eq('type', 'ingest_historical')
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(1)
  .single();

if (lastJob?.completed_at) {
  payload.since_timestamp = lastJob.completed_at;
}

// Atomic: create job only if none active
const { data: result, error: rpcErr } = await supaAdmin.rpc('create_job_if_none_active', {
  _type: 'ingest_historical',  // ou 'sync_contacts'
  _created_by: callerUserId,
  _payload: payload,
});

if (rpcErr) throw new Error('Failed: ' + rpcErr.message);

const { job_id, already_running } = result[0];
```

Se `already_running === true`, retorna o job existente sem criar novo. Zero race condition.

### Frontend: desabilitar botão

`SettingsPage.tsx` — desabilitar os botões "Sincronizar" quando `syncState.syncing === true`.

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Criar function `create_job_if_none_active` |
| `supabase/functions/ingest-gist-historical/index.ts` | Usar RPC atômico |
| `supabase/functions/sync-gist-contacts/index.ts` | Usar RPC atômico |
| `src/pages/SettingsPage.tsx` | Desabilitar botões durante sync |

