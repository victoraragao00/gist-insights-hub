

## Plan: Correção definitiva — Full sync semanal + re-resolução de órfãos + re-ingestão de participantes com 0 interações

### Diagnóstico confirmado

| Dado | Valor |
|------|-------|
| Amanda Lunardelli em `participants` | **Inexistente** |
| Participantes órfãos (`client_id IS NULL`) | **168** |
| Participantes Lofty Style mapeados | 20 (todos com 0 interações exceto Amanda Rego) |
| Causa raiz | Sync incremental com `since_timestamp` nunca revisita contatos antigos |

O matching de slugs funciona para `loftystyle` (sem hífen). O problema real é que Amanda nunca foi alcançada pelo sync incremental porque seu `last_seen_at` era anterior ao `since_timestamp`.

### Alterações

#### 1. `schedule-sync/index.ts` — Full sync semanal

Adicionar lógica para verificar se o último full sync (job `sync_contacts` sem `since_timestamp`) tem mais de 7 dias. Se sim, criar o job **sem** `since_timestamp`, forçando varredura completa.

Também criar um job `ingest_historical` sem `since_timestamp` quando o full sync for disparado, garantindo que conversas antigas sejam re-ingeridas.

#### 2. `process-jobs/index.ts` — Re-resolução de órfãos

No final de `handleSyncContacts`, adicionar etapa que:
1. Busca participantes com `client_id IS NULL` e `side = 'client'`
2. Para cada um, tenta resolver via email/domínio no `identifiers` usando a mesma lógica de matching
3. Atualiza o `client_id` quando encontrar match

Também adicionar normalização de hífens no matching de domínio (linha 281):
```typescript
const normSlug = existingSlug.replace(/-/g, '');
const normDomain = domainSlug.replace(/-/g, '');
if (normSlug.includes(normDomain) || normDomain.includes(normSlug))
```

#### 3. `process-jobs/index.ts` — Aumentar limite de participantes

Atualmente busca apenas 1000 participantes (linha 394). Aumentar para 5000 para garantir cobertura completa.

#### 4. Migration — Fix imediato para Amanda

Consultar a API do Gist para encontrar o `gist_id` da Amanda não é possível via migration. Em vez disso, o próximo full sync (sem `since_timestamp`) vai automaticamente descobrir e mapear a Amanda.

Para forçar a execução imediata, o plano inclui um trigger manual do `schedule-sync` após o deploy.

### Garantias

| Preocupação | Garantia |
|-------------|----------|
| Perda de dados existentes | Zero — `ON CONFLICT DO NOTHING` na ingestão, `upsert` nos participantes |
| Dados anteriores a hoje no Gist | Full sync semanal sem `since_timestamp` varre **todos** os contatos |
| Órfãos acumulados | Re-resolução automática a cada sync |
| Participantes sem interações | Full sync + ingestão sem `since_timestamp` traz conversas antigas |

### Files changed

| Action | File |
|--------|------|
| Edit | `supabase/functions/schedule-sync/index.ts` (full sync semanal) |
| Edit | `supabase/functions/process-jobs/index.ts` (normalização de hífens + re-resolução de órfãos + limite de participantes) |

### No changes to
- Migrations, RLS, frontend, `src/integrations/supabase/*`, `.env`

