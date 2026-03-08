# Sessao 5 — DB Function client_tone_trend_7d

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: MEDIA

Leia CONTEXT.md antes de comecar.

## Tarefa: criar DB function client_tone_trend_7d

Retorna distribuicao de tom por dia nos ultimos 7 dias para um cliente especifico. Sera usado em grafico na ClientDetailPage.

```sql
CREATE OR REPLACE FUNCTION client_tone_trend_7d(
  p_user_id uuid,
  p_client_id uuid
)
RETURNS TABLE(day date, ok bigint, atencao bigint, alerta bigint, critico bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
  ),
  days AS (
    SELECT generate_series(
      date_trunc('day', now() - interval '6 days'),
      date_trunc('day', now()),
      interval '1 day'
    ) AS day
  )
  SELECT
    d.day::date,
    COUNT(*) FILTER (WHERE i.tone = 'ok') AS ok,
    COUNT(*) FILTER (WHERE i.tone = 'atencao') AS atencao,
    COUNT(*) FILTER (WHERE i.tone = 'alerta') AS alerta,
    COUNT(*) FILTER (WHERE i.tone = 'critico') AS critico
  FROM days d
  LEFT JOIN interactions i
    ON i.client_id = p_client_id
    AND i.occurred_at >= d.day
    AND i.occurred_at < d.day + interval '1 day'
  WHERE EXISTS (SELECT 1 FROM accessible WHERE cid = p_client_id)
  GROUP BY d.day
  ORDER BY d.day;
$$;
```

### IMPORTANTE

- `generate_series` com `timestamptz` (NAO date) para evitar problemas de timezone
- Range comparison INDEX-FRIENDLY: `occurred_at >= d.day AND occurred_at < d.day + interval '1 day'`
- NUNCA usar `occurred_at::date = d.day::date` — mata o indice
- WHERE EXISTS verifica acesso do usuario ao cliente ANTES do JOIN
- Retorna sempre 7 rows (dias sem dados = zeros via LEFT JOIN)

### Nao fazer

- Nao alterar a tabela interactions
- Nao criar indices novos
- Nao criar hooks ou componentes UI

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
  - Se client_id nao e acessivel, retorna 0 rows
```
