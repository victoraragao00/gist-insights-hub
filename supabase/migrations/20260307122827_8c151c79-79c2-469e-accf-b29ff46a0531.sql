-- Step 1: Cancel any active classify_batch jobs
UPDATE sync_jobs 
SET status = 'cancelled', completed_at = now() 
WHERE type = 'classify_batch' AND status IN ('pending', 'running');

-- Step 2: Reset interactions with invalid themes from previous runs
UPDATE interactions 
SET classified_at = NULL, theme = NULL, theme_detail = NULL, tone = 'ok', tone_detail = NULL, sentiment = NULL, is_out_of_scope = NULL, classification_model = NULL
WHERE classified_at IS NOT NULL 
  AND theme IS NOT NULL 
  AND theme NOT IN ('integracao_erp', 'agendamento', 'permissoes', 'cobranca_followup', 'gestao_demandas', 'workflow', 'importacao_dados', 'intermediacao', 'bugs', 'criacao_campos', 'treinamento', 'elogio', 'governanca', 'outro');