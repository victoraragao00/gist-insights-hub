
# Sincronização Automática Agendada — IMPLEMENTADO

## O que foi feito

### 1. Tabela `app_settings`
- Criada com RLS (SELECT/UPDATE para authenticated)
- Flag `auto_sync_enabled = true` inserida

### 2. RLS para jobs automáticos
- `sync_jobs_automated_select`: jobs sem `created_by` visíveis a qualquer autenticado
- `sync_jobs_automated_update`: qualquer autenticado pode cancelar jobs automáticos travados

### 3. Edge Function `schedule-sync`
- Verifica `auto_sync_enabled` antes de criar jobs
- Busca `since_timestamp` do último job concluído de cada tipo
- Chama `create_job_if_none_active` com `_created_by = NULL`
- Fire-and-forget para `process-jobs`

### 4. Crons (pg_cron, horários em UTC ajustados para BRT)
| Nome | Schedule (UTC) | BRT | Função |
|------|---------------|-----|--------|
| `schedule-sync-bh` | `*/5 11-21 * * 1-5` | 08:00–18:55 Seg-Sex | schedule-sync |
| `schedule-sync-eod` | `59 2 * * 2-6` | 23:59 Seg-Sex | schedule-sync |
| `process-jobs-fallback` | `*/3 11-22 * * 1-5` | 08:00–19:00 Seg-Sex | process-jobs |

Cron antigo `process-jobs` (`*/2 * * * *` 24/7) removido.

### 5. UI — Toggle na SettingsPage
- Card "Agendamento Automático" com Switch, Badge de status, info estática
- Lê/escreve `app_settings.auto_sync_enabled`
