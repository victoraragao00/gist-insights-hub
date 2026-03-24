# Prompt Lovable — Fix AP1: DELETE sem filtro auto_created em process-jobs

> Repositorio: https://github.com/HyTrackWater/gist-insights-hub
> Prioridade: CRITICA
> Dependencias: Nenhuma
> Auditoria ref: auditorias/AUDITORIA_20260322_1500.md (AP1)

---

## OBRIGATORIO

1. Em `supabase/functions/process-jobs/index.ts`, na funcao `handleIngestHistorical`, localizar o bloco de DELETE (aproximadamente linha 380):

   **Codigo atual (ERRADO):**
   ```typescript
   if (deleteClientId && startPage === 1) {
     const { error: delErr } = await supaAdmin.from('interactions').delete().eq('client_id', deleteClientId);
     if (delErr) return { has_more: false, progress, error: 'Delete failed: ' + delErr.message };
   }
   ```

   **Codigo corrigido (OBRIGATORIO):**
   ```typescript
   if (deleteClientId && startPage === 1) {
     const { error: delErr } = await supaAdmin
       .from('interactions')
       .delete()
       .eq('client_id', deleteClientId)
       .eq('metadata->>auto_created', 'true');
     if (delErr) return { has_more: false, progress, error: 'Delete failed: ' + delErr.message };
   }
   ```

2. O filtro `.eq('metadata->>auto_created', 'true')` DEVE estar presente. Isso garante que apenas interactions criadas automaticamente pelo sync sejam apagadas, protegendo dados manuais ou do cliente real (By NV).

---

## PROIBIDO

1. NAO remover o bloco de delete — ele e necessario para re-ingestao limpa
2. NAO alterar nenhuma outra parte de `process-jobs/index.ts`
3. NAO alterar outras Edge Functions
4. NAO tomar decisoes autonomas sobre o filtro — usar EXATAMENTE `metadata->>auto_created = 'true'`

---

## Problema

O handler `handleIngestHistorical` em `process-jobs` possui um DELETE que apaga TODAS as interactions de um client_id sem verificar se foram criadas automaticamente. Se o client tiver dados reais (manuais ou importados), eles serao perdidos irreversivelmente.

**Risco:** Perda de dados reais do cliente By NV (cliente principal da uMode).

**Principio violado:** PRD — "UPDATE/DELETE em massa filtra `metadata->>'auto_created' = 'true'`"

---

## Verificacao pos-deploy

```sql
-- Verificar que interactions manuais (sem auto_created) NAO sao afetadas
-- Rodar ANTES de testar o job:
SELECT count(*)
FROM interactions
WHERE client_id = '<client_id_teste>'
  AND (metadata->>'auto_created' IS NULL OR metadata->>'auto_created' != 'true');

-- Rodar DEPOIS de executar ingest_historical com delete_client_id:
-- O count acima DEVE ser identico (zero perda)
```

---

## Checklist CTO aplicavel

- [x] m8: Erros Supabase tratados (delErr verificado)
- [x] Protecao de dados reais (filtro auto_created)
- [x] Idempotencia preservada
