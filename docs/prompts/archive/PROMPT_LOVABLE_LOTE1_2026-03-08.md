# Prompts para Lovable — LOTE 1
# Data: 2026-03-08
# Instrucao: enviar cada bloco separadamente ao Lovable

---

## ISSUE #37 — global_stats_30d

Leia o CONTEXT.md do repositorio antes de comecar.

Implemente a Issue #37 do GitHub (github.com/HyTrackWater/gist-insights-hub/issues/37).

Resumo: criar DB function `global_stats_30d(p_user_id uuid)` que retorna KPIs agregados para o Dashboard.

Campos de retorno:
- total_interactions_30d (int)
- pct_critico (float)
- pct_alerta (float)
- total_clients_monitored (int)
- last_calculated_at (timestamptz)
- monthly_tone_evolution (jsonb) — array de {mes, ok, atencao, alerta, critico}, ultimos 6 meses
- top_themes (jsonb) — array de {theme, count}, top 5

Regras:
- Filtrar apenas interacoes com classified_at IS NOT NULL
- Filtrar por user_accessible_client_ids(p_user_id) para respeitar RLS
- Janela: 30 dias para totais, 6 meses para evolucao
- Performance target: < 500ms para ~21k interacoes
- Retornar zeros/arrays vazios se nao houver dados

Entregaveis:
1. Migration SQL com a function
2. Regenerar types.ts

IMPORTANTE — Frontend Contract:
Inclua no PR uma secao "Frontend Contract" com:
- Return type exato (campos e tipos TypeScript)
- queryKey sugerido: ["global-stats", user?.id]
- staleTime sugerido: 5 * 60_000
- enabled: !!user?.id
- Edge cases documentados

CTO Checklist:
- m1: Zero `any`
- m8: Erros tratados (retornar defaults se sem dados)
- m11: Zero codigo nao usado

---

## ISSUE #38 — evaluate-audit-rules

Leia o CONTEXT.md do repositorio antes de comecar.

Implemente a Issue #38 do GitHub (github.com/HyTrackWater/gist-insights-hub/issues/38).

Resumo: nova Edge Function `evaluate-audit-rules` que avalia regras de auditoria e gera alertas automaticos.

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

Env vars: AUDIT_BATCH_SIZE=20

IMPORTANTE — Frontend Contract:
Inclua no PR uma secao "Frontend Contract" com:
- Tipos de audit_alerts e audit_rules para o frontend consumir
- Hooks sugeridos: useAuditAlerts (queryKey, staleTime 30s) e useAuditRules (queryKey, staleTime 5min)
- Edge cases documentados

CTO Checklist:
- m1: Zero `any`
- m8: Erros Supabase tratados
- m11: Zero imports nao usados
- m13: 8 testes unitarios
- Playbook: single-responsibility, zero hardcoded, logs sem dados sensiveis
- PRD: batch + hasMore + auto-chain
