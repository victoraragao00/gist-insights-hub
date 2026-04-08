
CREATE OR REPLACE FUNCTION public.get_client_conversations_with_status(p_client_id uuid)
RETURNS TABLE (
  conversation_id TEXT,
  contact_name TEXT,
  last_message TEXT,
  last_sender_side TEXT,
  last_occurred_at TIMESTAMPTZ,
  total_messages BIGINT,
  worst_tone TEXT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.conversation_id,
    MIN(CASE WHEN i.sender_side = 'client' THEN i.sender_raw END) AS contact_name,
    (ARRAY_AGG(i.content ORDER BY i.occurred_at DESC))[1] AS last_message,
    (ARRAY_AGG(i.sender_side ORDER BY i.occurred_at DESC))[1] AS last_sender_side,
    MAX(i.occurred_at) AS last_occurred_at,
    COUNT(*) AS total_messages,
    CASE
      WHEN bool_or(i.tone = 'critico') THEN 'critico'
      WHEN bool_or(i.tone = 'alerta') THEN 'alerta'
      WHEN bool_or(i.tone = 'atencao') THEN 'atencao'
      ELSE 'ok'
    END AS worst_tone,
    CASE
      WHEN (ARRAY_AGG(i.sender_side ORDER BY i.occurred_at DESC))[1] = 'client'
        THEN 'sem_resposta'
      WHEN MAX(i.occurred_at) < now() - interval '7 days'
        THEN 'inativo'
      ELSE 'em_andamento'
    END AS status
  FROM public.interactions i
  WHERE i.client_id = p_client_id
    AND i.conversation_id IS NOT NULL
  GROUP BY i.conversation_id
  ORDER BY MAX(i.occurred_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_conversations_with_status(uuid) TO authenticated;
