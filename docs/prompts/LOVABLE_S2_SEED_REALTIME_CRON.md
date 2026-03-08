# Sessao 2 — Seed audit_rules + Realtime + pg_cron

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: ALTA
Depende de: Sessao 1 (RLS policies) — pode rodar em sequencia

Leia CONTEXT.md antes de comecar.

## Tarefa 1 — Seed audit_rules

Inserir 3 regras default para cada cliente com `client_priority_config.active = true`:

```sql
INSERT INTO audit_rules (client_id, metric, operator, threshold, active, cooldown_hours)
SELECT
  cpc.client_id,
  m.metric,
  m.operator,
  m.threshold,
  true,
  m.cooldown_hours
FROM client_priority_config cpc
CROSS JOIN (VALUES
  ('score_prioridade', '>=', 80::numeric, 24),
  ('tom_critico_pct', '>=', 15::numeric, 24),
  ('volume_periodo', '>=', 50::numeric, 48)
) AS m(metric, operator, threshold, cooldown_hours)
WHERE cpc.active = true
ON CONFLICT DO NOTHING;
```

Se `audit_rules` nao tem unique constraint para evitar duplicatas, adicionar:

```sql
ALTER TABLE audit_rules ADD CONSTRAINT audit_rules_client_metric_unique
  UNIQUE (client_id, metric);
```

## Tarefa 2 — Realtime para audit_alerts

Habilitar Realtime na tabela `audit_alerts`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE audit_alerts;
```

## Tarefa 3 — pg_cron para evaluate-audit-rules

Agendar execucao a cada 2h (safety net, mesmo padrao de calculate-priority-scores):

```sql
SELECT cron.schedule(
  'evaluate-audit-rules-every-2h',
  '15 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/evaluate-audit-rules',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Nao fazer

- Nao alterar evaluate-audit-rules Edge Function
- Nao alterar calculate-priority-scores
- Nao alterar client_priority_config

### Frontend Contract

```
Tabela: audit_rules
Colunas: id, client_id, metric (text), operator (text), threshold (numeric), active (bool), cooldown_hours (int), created_at
Seed: 3 regras x N clientes ativos

Tabela: audit_alerts (Realtime habilitado)
Colunas: id, rule_id, client_id, metric_value (numeric), message (text), read (bool), created_at
Realtime: INSERT events disponiveis via supabase.channel()
```
