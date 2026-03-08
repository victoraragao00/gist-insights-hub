# evaluate-audit-rules

Edge Function para avaliação automática de regras de auditoria e geração de alertas.

## Descrição

Avalia regras ativas em `audit_rules`, calcula métricas, e insere alertas em `audit_alerts` quando condições são violadas.

## Endpoints

### POST /functions/v1/evaluate-audit-rules

**Authorization:** Apenas `service_role_key` (automated trigger).

**Body:**
```json
{
  "_offset": 0  // opcional, para paginação
}
```

**Response:**
```json
{
  "evaluated": 5,
  "alerts_created": 2,
  "hasMore": false
}
```

## Métricas Suportadas

| Métrica | Descrição |
|---------|-----------|
| `score_prioridade` | Score de prioridade do cliente (0-100) |
| `tom_critico_pct` | % de interações com tom crítico na janela |
| `tom_alerta_pct` | % de interações com tom alerta na janela |
| `volume_periodo` | Total de interações na janela |

## Trigger

Chamado automaticamente após `calculate-priority-scores` completar (fire-and-forget):

```typescript
if (!hasMore) {
  const auditUrl = `${supabaseUrl}/functions/v1/evaluate-audit-rules`;
  fetch(auditUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({}),
  }).catch(() => {});
}
```

## Environment Variables

| Variável | Default | Descrição |
|----------|---------|-----------|
| `AUDIT_BATCH_SIZE` | 20 | Regras por batch |

## Security

- Aceita APENAS `service_role_key` — não permite JWT de usuários
- Logs NÃO expõem `alert_recipients` ou dados pessoais
- Padrão de log: `rule={id} metric={name} value={number} triggered={bool}`

## Fluxo

1. Auth check (service role only)
2. Fetch active rules (paginated)
3. For each rule:
   - Calculate metric value
   - Evaluate rule condition
   - Check cooldown
   - Insert alert if triggered
4. Auto-chain if hasMore

## Testes

```bash
deno test supabase/functions/evaluate-audit-rules/index.test.ts
```
