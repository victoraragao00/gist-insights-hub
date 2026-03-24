# Prompt Lovable — Fix AP3: INSERTs sem conflict handling em gist-confirm-mapping

> Repositorio: https://github.com/HyTrackWater/gist-insights-hub
> Prioridade: ALTA
> Dependencias: Nenhuma
> Auditoria ref: auditorias/AUDITORIA_20260322_1500.md (AP3)

---

## OBRIGATORIO

Em `supabase/functions/gist-confirm-mapping/index.ts`, adicionar tratamento de conflito nos seguintes INSERTs:

### 1. INSERT de clients (linha ~77)

**Codigo atual:**
```typescript
const { data: newClient, error: insertError } = await supaAdmin
  .from('clients')
  .insert({ name: clientName, slug })
  .select('id')
  .single();
```

**Codigo corrigido:**
```typescript
const { data: newClient, error: insertError } = await supaAdmin
  .from('clients')
  .upsert({ name: clientName, slug }, { onConflict: 'slug' })
  .select('id')
  .single();
```

### 2. INSERT de user_client_access (linha ~91 e ~116)

**Codigo atual (ambas ocorrencias):**
```typescript
await supaAdmin.from('user_client_access').insert({
  user_id: callerUserId,
  client_id: newClient.id,
  role: 'admin',
});
```

**Codigo corrigido (ambas ocorrencias):**
```typescript
await supaAdmin.from('user_client_access').upsert({
  user_id: callerUserId,
  client_id: clientId,
  role: 'admin',
}, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
```

Nota: Na primeira ocorrencia (linha ~91), usar `newClient.id` como `client_id`. Na segunda (linha ~116, dentro do loop de existing clients), usar a variavel `clientId` do loop.

### 3. INSERT de channel_bindings (linha ~241)

**Codigo atual:**
```typescript
const { error: bindInsertError } = await supaAdmin
  .from('channel_bindings')
  .insert({
    client_id: clientId,
    channel: 'gist',
    channel_identifier: 'gist-workspace',
    label: 'Gist',
  });
```

**Codigo corrigido:**
```typescript
const { error: bindInsertError } = await supaAdmin
  .from('channel_bindings')
  .upsert({
    client_id: clientId,
    channel: 'gist',
    channel_identifier: 'gist-workspace',
    label: 'Gist',
  }, { onConflict: 'client_id,channel', ignoreDuplicates: true });
```

### 4. Participants — JA TRATADOS

Os INSERTs de participants (linhas ~162, ~201) ja fazem lookup antes de inserir. Manter como esta.

---

## PROIBIDO

1. NAO alterar a logica de negocio (mapeamento, agrupamento por dominio)
2. NAO alterar a logica de participants (ja trata duplicatas via lookup)
3. NAO alterar outras Edge Functions
4. NAO remover o lookup de `user_client_access` existente (linha ~108-114) — ele verifica se o acesso ja existe antes de inserir para clients existentes. Substituir pelo upsert conforme acima.
5. NAO tomar decisoes autonomas

---

## Problema

`gist-confirm-mapping` e executada quando o usuario confirma o mapeamento de contatos do Gist para clientes. Se o usuario re-executar o wizard (ou houver timeout + retry), os INSERTs de clients, user_client_access e channel_bindings falham com unique violation, causando erro 500 e mapeamento incompleto.

---

## Verificacao pos-deploy

1. Executar o GistContactWizard com mapeamentos que ja existem
2. Deve completar sem erro (upserts ignoram duplicatas)
3. Verificar que dados existentes nao foram alterados indevidamente:
```sql
-- Clients nao duplicados
SELECT slug, count(*) FROM clients GROUP BY slug HAVING count(*) > 1;
-- Deve retornar 0 rows

-- Channel bindings nao duplicados
SELECT client_id, channel, count(*) FROM channel_bindings GROUP BY client_id, channel HAVING count(*) > 1;
-- Deve retornar 0 rows
```

---

## Checklist CTO aplicavel

- [x] m8: Erros Supabase tratados
- [x] Idempotencia (ON CONFLICT / upsert em toda ingestao)
