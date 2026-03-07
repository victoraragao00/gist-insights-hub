
# Classificação Automática (classify_batch) — IMPLEMENTADO

## O que foi feito

### 1. Handler `handleClassifyBatch` em `process-jobs/index.ts`
- Query: `interactions WHERE classified_at IS NULL AND content IS NOT NULL AND content != '' AND occurred_at >= now() - 90 days ORDER BY occurred_at DESC LIMIT 20`
- Fallback: Gemini 2.5 Flash → Claude Sonnet 4 (se Gemini falhar)
- Campos atualizados: `theme`, `theme_detail`, `tone`, `tone_detail`, `sentiment`, `is_out_of_scope`, `classified_at`, `classification_model`
- Progress acumulativo: `classified: previousClassified + classifiedCount`
- Heartbeat chamado após UPDATE do batch

### 2. Case no switch do main loop
- `case 'classify_batch'` adicionado, chamando `handleClassifyBatch(supaAdmin, job, updateHeartbeat)`

### 3. Agendamento automático
- `classify_batch` adicionado ao array `jobTypes` em `schedule-sync/index.ts`

### Resiliência (coberta pelo main loop genérico)
| Mecanismo | Cobertura |
|-----------|-----------|
| Auto-chain | Handler retorna `has_more: true` quando batch = 20 |
| Heartbeat | `updateHeartbeat()` chamado após UPDATE |
| Retry | throw → main loop incrementa retry_count |
| Fallback | Gemini → Claude dentro do handler |
| Órfãos | Query genérica de reset já cobre |
