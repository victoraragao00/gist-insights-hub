# Sessao 4 — DB Function search_interactions

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: MEDIA

Leia CONTEXT.md antes de comecar.

## Tarefa: criar DB function search_interactions

Busca full-text em interacoes com filtros opcionais e paginacao.

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
  )
  SELECT
    i.id,
    c.name AS client_name,
    i.sender_raw,
    i.sender_side,
    i.body,
    i.tone,
    i.theme,
    i.occurred_at,
    COUNT(*) OVER() AS total_count
  FROM interactions i
  JOIN accessible a ON i.client_id = a.cid
  JOIN clients c ON i.client_id = c.id
  WHERE i.search_vector @@ plainto_tsquery('portuguese', p_query)
    AND (p_client_id IS NULL OR i.client_id = p_client_id)
    AND (p_tone IS NULL OR i.tone = p_tone)
  ORDER BY ts_rank(i.search_vector, plainto_tsquery('portuguese', p_query)) DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
```

### IMPORTANTE

- Colunas corretas: `sender_raw` e `sender_side` (NAO sender_name/sender_type — essas nao existem)
- Usar `search_vector @@ plainto_tsquery` — a tabela ja tem indice tsvector
- Usar `ts_rank` para ordenacao por relevancia
- `COUNT(*) OVER()` retorna total para paginacao no frontend
- NAO usar ILIKE — ignora o indice tsvector existente

### Nao fazer

- Nao alterar a tabela interactions
- Nao criar indices novos (search_vector ja esta indexado)
- Nao criar hooks ou componentes UI

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
  total_count: number

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
