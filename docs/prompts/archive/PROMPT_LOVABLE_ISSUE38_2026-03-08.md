Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Issue: https://github.com/HyTrackWater/gist-insights-hub/issues/38

Leia o CONTEXT.md do repositorio antes de comecar.

Implemente a Issue #38: nova Edge Function `evaluate-audit-rules` que avalia regras de auditoria ativas e gera alertas automaticos na tabela audit_alerts.

Estrutura modular (mesmo padrao de calculate-priority-scores):
```
supabase/functions/evaluate-audit-rules/
  index.ts        — handler (Deno.serve)
  logic.ts        — funcoes puras: evaluateRule, checkCooldown
  index.test.ts   — 8 testes unitarios
  README.md       — documentacao
```

Metricas suportadas:
- score_prioridade: SELECT score FROM priority_scores WHERE client_id = rule.client_id
- tom_critico_pct: % de interacoes com tone='critico' nos ultimos window_hours
- tom_alerta_pct: % com tone='alerta'
- volume_periodo: COUNT de interacoes nos ultimos window_hours

Fluxo:
1. Auth: aceitar apenas service_role_key → 401 se diferente
2. fetchActiveRules com batch (AUDIT_BATCH_SIZE env, default 20)
3. Para cada rule: calculateMetric → evaluateRule → checkCooldown → insertAlert
4. Se hasMore → auto-chain (fire-and-forget)
5. Return { evaluated, alerts_created, hasMore }

Trigger: encadear no final de calculate-priority-scores/index.ts quando !hasMore:
```typescript
if (!hasMore) {
  const auditUrl = `${supabaseUrl}/functions/v1/evaluate-audit-rules`;
  fetch(auditUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({}),
  }).catch(() => {});
}
```

Testes (8 casos):
- evaluateRule: '>' acima→true, '>' igual→false, '>=' igual→true, '<' abaixo→true, desconhecido→false
- checkCooldown: sem alerta anterior→false, fora cooldown→false, dentro cooldown→true

Log policy:
- NUNCA logar: conteudo de interacoes, dados pessoais, alert_recipients
- OK logar: rule_id, metric, metric_value, threshold, triggered

Env vars: AUDIT_BATCH_SIZE=20 (declarar no Supabase Dashboard)

IMPORTANTE — Frontend Contract:
Inclua no PR uma secao "Frontend Contract" com:
- Tipos TypeScript de audit_alerts e audit_rules para o frontend consumir
- Hooks sugeridos:
  - useAuditAlerts: queryKey ["audit-alerts", {page, status_filter}], staleTime 30_000
  - useAuditRules: queryKey ["audit-rules"], staleTime 5 * 60_000
- Edge cases: alerts pode ser vazio, delivery_status comeca como 'pending', client_id pode ser null em regras globais, window_hours/cooldown_hours podem ser null

CTO Checklist:
- m1: Zero `any`
- m8: Erros Supabase tratados
- m11: Zero imports nao usados
- m13: 8 testes unitarios
- Playbook: single-responsibility, zero hardcoded, logs sem dados sensiveis
- PRD: batch + hasMore + auto-chain
