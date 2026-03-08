# Lovable Marathon — 6 Sessoes Planejadas
# Gerado por Claude Code em 2026-03-08
# Repositorio: https://github.com/HyTrackWater/gist-insights-hub

---

## Sessao 1 — RLS Policies (L2)
**Prioridade: CRITICA**

Criar RLS policies para `audit_rules` e `audit_alerts`:

### audit_rules
- SELECT: `client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid())))`
- INSERT: mesmo filtro + role = 'admin'
- UPDATE: mesmo filtro + role = 'admin'
- DELETE: mesmo filtro + role = 'admin'

### audit_alerts
- SELECT: `client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid())))`
- INSERT: apenas via service_role (evaluate-audit-rules)

### Frontend Contract
Nenhum — RLS e transparente para o frontend.

---

## Sessao 2 — Seed + Realtime + pg_cron (L3 + L5)
**Prioridade: ALTA**

### Seed audit_rules
3 regras default para todos os clientes com `client_priority_config.active = true`:
- `score_prioridade >= 80` (critico)
- `tom_critico_pct >= 15` (alerta de tom)
- `volume_periodo >= 50` (volume alto)

### Realtime
Habilitar `supabase_realtime` publication para tabela `audit_alerts`.

### pg_cron
Agendar `evaluate-audit-rules` a cada 2h (safety net, igual calculate-priority-scores).

### Frontend Contract
```
Tabela: audit_rules
Colunas: id, client_id, metric (text), operator (text), threshold (numeric), active (bool), cooldown_hours (int), created_at
Seed: 3 regras x N clientes ativos

Tabela: audit_alerts (Realtime habilitado)
Colunas: id, rule_id, client_id, metric_value (numeric), message (text), read (bool), created_at
Realtime: INSERT events disponiveis via supabase.channel()
```

---

## Sessao 3 — DB Function audit_alerts_summary (M2)
**Prioridade: ALTA**

```sql
CREATE OR REPLACE FUNCTION audit_alerts_summary(p_user_id uuid)
RETURNS TABLE(
  total_alerts_30d bigint,
  unread_count bigint,
  alerts jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
```

- CTE com `unnest(user_accessible_client_ids(p_user_id))` para filtrar
- JOIN com `audit_rules` e `clients` para nomes
- alerts: array dos ultimos 50 alertas com client_name, rule metric, metric_value, message, read, created_at
- Janela: 30 dias

### Frontend Contract
```
DB Function: audit_alerts_summary(p_user_id uuid)

Return type:
  total_alerts_30d: number
  unread_count: number
  alerts: {
    id: string
    client_name: string
    metric: string
    metric_value: number
    message: string
    read: boolean
    created_at: string
  }[]

Suggested hook:
  queryKey: ["audit-alerts-summary", user?.id]
  staleTime: 30_000 (alertas sao dinamicos)
  enabled: !!user?.id

Edge cases:
  - Retorna zeros e array vazio se nao houver alertas
  - alerts limitado a 50 mais recentes
  - read=false indica alerta nao lido
```

---

## Sessao 4 — DB Function search_interactions (L4)
**Prioridade: MEDIA**

```sql
CREATE OR REPLACE FUNCTION search_interactions(
  p_user_id uuid,
  p_query text,
  p_client_id uuid DEFAULT NULL,
  p_tone text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  client_name text,
  sender_raw text,
  sender_side text,
  body text,
  tone text,
  theme text,
  occurred_at timestamptz,
  total_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
```

- Usar `search_vector @@ plainto_tsquery('portuguese', p_query)` com `ts_rank` para ordenacao
- `COUNT(*) OVER() AS total_count` para paginacao
- Filtros opcionais: p_client_id, p_tone
- CTE com `unnest(user_accessible_client_ids(p_user_id))`
- IMPORTANTE: colunas sao `sender_raw` e `sender_side` (NAO sender_name/sender_type)

### Frontend Contract
```
DB Function: search_interactions(p_user_id, p_query, p_client_id?, p_tone?, p_limit?, p_offset?)

Return type:
  id: string
  client_name: string
  sender_raw: string
  sender_side: string
  body: string
  tone: string
  theme: string
  occurred_at: string
  total_count: number  -- para paginacao

Suggested hook:
  queryKey: ["search-interactions", user?.id, query, clientId, tone, page]
  staleTime: 30_000
  enabled: !!user?.id && query.length >= 3

Edge cases:
  - total_count vem em cada row (usar primeira row para total)
  - Array vazio se nenhum match
  - p_query obrigatorio, demais opcionais
  - Paginacao: p_limit=20, p_offset=0 default
```

---

## Sessao 5 — DB Function client_tone_trend_7d (M4)
**Prioridade: MEDIA**

```sql
CREATE OR REPLACE FUNCTION client_tone_trend_7d(
  p_user_id uuid,
  p_client_id uuid
)
RETURNS TABLE(day date, ok bigint, atencao bigint, alerta bigint, critico bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
```

- `generate_series(now() - interval '6 days', now(), interval '1 day')` com `timestamptz`
- Range comparison INDEX-FRIENDLY: `occurred_at >= d.day AND occurred_at < d.day + interval '1 day'`
- NAO usar `occurred_at::date = d.day::date` (mata index)
- CTE com `unnest(user_accessible_client_ids(p_user_id))`
- Retorna 7 linhas (uma por dia), zeros se sem dados

### Frontend Contract
```
DB Function: client_tone_trend_7d(p_user_id uuid, p_client_id uuid)

Return type:
  day: string (date)
  ok: number
  atencao: number
  alerta: number
  critico: number

Suggested hook:
  queryKey: ["client-tone-trend", user?.id, clientId]
  staleTime: 5 * 60_000
  enabled: !!user?.id && !!clientId

Edge cases:
  - Sempre retorna 7 rows (dias sem dados = zeros)
  - Verifica acesso do user ao client via user_accessible_client_ids
```

---

## Sessao 6 — Edge Function deliver-audit-alerts (L1)
**Prioridade: BAIXA (futuro)**

Notificacao por email/webhook quando `audit_alerts` sao criados.
Depende de decisao sobre canal de notificacao (email, Slack, webhook).
Pode ser adiada sem impacto no frontend.

---

## SQL Patterns Obrigatorios (para todas as sessoes)

1. `user_accessible_client_ids()` retorna `uuid[]` — SEMPRE usar `unnest()`:
   ```sql
   WITH accessible AS (
     SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
   )
   ```

2. Date ranges INDEX-FRIENDLY:
   ```sql
   occurred_at >= d.day AND occurred_at < d.day + interval '1 day'
   ```
   NUNCA: `occurred_at::date = d.day::date`

3. Colunas de interactions: `sender_raw` e `sender_side` (NAO sender_name/sender_type)

4. Full-text search: `search_vector @@ plainto_tsquery('portuguese', p_query)` com `ts_rank`
