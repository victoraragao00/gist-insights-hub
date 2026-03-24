# Prompt Lovable — Fix AP2: INSERT audit_alerts sem ON CONFLICT em evaluate-audit-rules

> Repositorio: https://github.com/HyTrackWater/gist-insights-hub
> Prioridade: ALTA
> Dependencias: Nenhuma
> Issue: #72 (mesmo deploy pode incluir)
> Auditoria ref: auditorias/AUDITORIA_20260322_1500.md (AP2)

---

## OBRIGATORIO

1. Em `supabase/functions/evaluate-audit-rules/index.ts`, na funcao `insertAlert` (aproximadamente linha 155-170), alterar o INSERT para incluir tratamento de conflito.

   **Codigo atual:**
   ```typescript
   const { error } = await supaAdmin
     .from('audit_alerts')
     .insert({
       rule_id: rule.id,
       client_id: rule.client_id,
       metric_value: metricValue,
       threshold: rule.threshold,
       message,
       delivery_status: 'pending',
     });

   if (error) throw new Error(`insertAlert failed: ${error.message}`);
   ```

   **Codigo corrigido:**
   ```typescript
   const { error } = await supaAdmin
     .from('audit_alerts')
     .insert({
       rule_id: rule.id,
       client_id: rule.client_id,
       metric_value: metricValue,
       threshold: rule.threshold,
       message,
       delivery_status: 'pending',
     });

   if (error) {
     // Ignore duplicate — cooldown should prevent, but be defensive
     if (error.code === '23505') {
       console.log(`[evaluate-audit] rule=${rule.id} duplicate alert ignored`);
       return;
     }
     throw new Error(`insertAlert failed: ${error.message}`);
   }
   ```

2. O cooldown ja previne duplicatas na maioria dos casos, mas se dois workers avaliarem a mesma regra simultaneamente (race condition), o INSERT pode falhar com unique violation. O fix trata esse caso graciosamente.

---

## PROIBIDO

1. NAO alterar a logica de cooldown — ela esta correta
2. NAO alterar a logica de calculateMetric ou evaluateRule
3. NAO alterar outras Edge Functions
4. NAO tomar decisoes autonomas

---

## Problema

A funcao `insertAlert` em `evaluate-audit-rules` faz INSERT sem tratamento de conflito. Se dois workers avaliarem a mesma regra ao mesmo tempo (pg_cron + chain + trigger manual), o segundo INSERT pode falhar com unique violation e derrubar todo o batch.

---

## Verificacao pos-deploy

```sql
-- Verificar que alertas estao sendo criados normalmente
SELECT count(*), max(created_at) FROM audit_alerts WHERE created_at > now() - interval '1 day';
```

---

## Checklist CTO aplicavel

- [x] m8: Erros Supabase tratados (error code check)
- [x] Idempotencia (duplicata ignorada graciosamente)
