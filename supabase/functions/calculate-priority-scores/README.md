# calculate-priority-scores

Base URL: `{SUPABASE_URL}/functions/v1/calculate-priority-scores`

## Authorization

- **Manual trigger**: `Bearer {JWT_TOKEN}` — authenticated user, `role='admin'` required in `user_client_access`
- **Automatic trigger**: `Bearer {SUPABASE_SERVICE_ROLE_KEY}` — cron / event-driven

## Default Headers

```
Content-Type: application/json
Authorization: Bearer ...
```

## Endpoints

### POST /

Recalculates priority scores for one or all clients.

**Body** (all fields optional):

| Field     | Type   | Description                                         |
|-----------|--------|-----------------------------------------------------|
| client_id | UUID   | Limits to a specific client. Absent = all clients   |
| _offset   | number | Internal — used by auto-chain. Do not set manually  |

**Sample Response — success (200):**

```json
{ "processed": 15, "hasMore": false, "calculatedAt": "2026-03-08T14:00:00Z" }
```

**Sample Response — unauthorized (401):**

```json
{ "error": "Unauthorized" }
```

**Sample Response — forbidden (403):**

```json
{ "error": "Forbidden" }
```

**Sample Response — client not found (404):**

```json
{ "error": "Client config not found or inactive" }
```

**Sample Response — internal error (500):**

```json
{ "error": "Internal error", "details": "error message without sensitive data" }
```

## Security Features

- JWT required for manual triggers
- `role='admin'` verified via query on `user_client_access`
- `role=null` treated as viewer (secure fallback) — returns 403
- Service role key for automated triggers (cron, event-driven)
- Writes to `priority_scores` only via service role (RLS blocks authenticated users)
- Logs never include interaction content or personal data

## Environment Variables

All business logic thresholds are configurable via environment variables with `PRIORITY_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `PRIORITY_SEVERITY_CRITICO` | 10 | Weight for critical tone |
| `PRIORITY_SEVERITY_ALERTA` | 5 | Weight for alert tone |
| `PRIORITY_SEVERITY_ATENCAO` | 2 | Weight for attention tone |
| `PRIORITY_RECENCY_RECENT_DAYS` | 3 | Days threshold for recent multiplier |
| `PRIORITY_RECENCY_MEDIUM_DAYS` | 7 | Days threshold for medium multiplier |
| `PRIORITY_RECENCY_RECENT_MULTIPLIER` | 2.0 | Multiplier for recent interactions |
| `PRIORITY_RECENCY_MEDIUM_MULTIPLIER` | 1.5 | Multiplier for medium-age interactions |
| `PRIORITY_RECENCY_BASE_MULTIPLIER` | 1.0 | Multiplier for older interactions |
| `PRIORITY_BATCH_SIZE` | 20 | Max clients per invocation |
