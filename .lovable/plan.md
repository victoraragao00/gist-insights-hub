
# Fase 5 — Priority Score Engine — IMPLEMENTADO (Issue #32)

## O que foi feito

### 1. Migration: ENUM + Tabelas + RLS
- ENUM `client_tier`: azzas, enterprise, medium, small
- Tabela `client_priority_config`: tier, weight_multiplier, recurrence_window_days, recurrence_threshold_users, active
- Tabela `priority_scores`: score, patterns (JSONB), calculated_at, UNIQUE(client_id)
- RLS: SELECT para todos com acesso ao client_id; write em config só admin; write em scores só service role

### 2. Edge Function `calculate-priority-scores`
- Modular: fetchClientConfigs, fetchClientInteractions, detectPatterns, calculateScore, upsertScore, handleAutoChain
- Todas constantes via env vars PRIORITY_* (zero hardcoded)
- Auth: manual trigger valida JWT + admin role; automático usa service role key
- Batch: max 20 clientes por invocação + auto-chain
- Logs: nunca incluem conteúdo de interações ou dados pessoais

### 3. Event-driven trigger em process-jobs
- Após classify_batch completar com sucesso: fire-and-forget POST para calculate-priority-scores

### 4. pg_cron: a cada 2 horas (safety net)

### 5. Seed: 13 clientes configurados
- By NV, Reserva, Oficina → azzas (weight_multiplier=4) — nota: apenas bynv encontrado
- Osklen, Caedu → enterprise (weight_multiplier=3) — nota: apenas osklen encontrado
- Restante → medium (weight_multiplier=2)

### 6. Resultado do primeiro cálculo
- By NV: score=536, 3 padrões (integracao_erp: 6 usuários, criacao_campos: 2, gestao_demandas: 2)
- Outros 12 clientes: score=0 (sem padrões recorrentes acima do threshold)

### 7. Variáveis de ambiente configuradas
PRIORITY_SEVERITY_CRITICO, PRIORITY_SEVERITY_ALERTA, PRIORITY_SEVERITY_ATENCAO,
PRIORITY_RECENCY_RECENT_DAYS, PRIORITY_RECENCY_MEDIUM_DAYS,
PRIORITY_RECENCY_RECENT_MULTIPLIER, PRIORITY_RECENCY_MEDIUM_MULTIPLIER,
PRIORITY_RECENCY_BASE_MULTIPLIER, PRIORITY_BATCH_SIZE

## Pendente: Issue #33 (Cursor — Frontend)
- Dashboard com lista ranqueada por score
- PriorityConfigTab em Settings
- UX fixes (branding, "Em breve", saúde invertida)
- Pré-requisito: types.ts regenerado
