-- Limpeza definitiva: deletar interacoes anteriores a 2026-01-01
-- Decisao do produto: historico anterior a 2026 nao tem valor analitico ativo
-- e estava reabastecendo a fila de classificacao IA, queimando creditos.

-- 1. Remover vinculos com demandas (FK)
DELETE FROM public.demand_interactions
WHERE interaction_id IN (
  SELECT id FROM public.interactions WHERE occurred_at < '2026-01-01T00:00:00Z'
);

-- 2. Deletar as interacoes propriamente ditas
DELETE FROM public.interactions
WHERE occurred_at < '2026-01-01T00:00:00Z';

-- 3. Cancelar jobs de classify_batch ativos para forcar releitura com nova janela
UPDATE public.sync_jobs
SET status = 'cancelled', completed_at = now()
WHERE type = 'classify_batch' AND status IN ('pending', 'running');