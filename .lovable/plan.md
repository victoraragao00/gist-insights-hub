

## Two Changes

### 1. Automate sync-gist-contacts via pg_cron

Run SQL using the Supabase insert tool (not migration, since it contains project-specific URLs/keys):

```sql
SELECT cron.schedule(
  'sync-gist-contacts-auto',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qyfwbmukylyfsgzgocfo.supabase.co/functions/v1/sync-gist-contacts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5ZndibXVreWx5ZnNnemdjZm8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0MDY5ODQ5MSwiZXhwIjoyMDU2Mjc0NDkxfQ.oaldMHMhpMBbhkFCtO4j8bAiJrjxuKnDNa9S9DqQhAo"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Pre-requisite**: Enable `pg_cron` and `pg_net` extensions first if not already enabled.

### 2. Update ClientDetailPage.tsx — two small edits

**a) KPI card (line 471-475)**: Change label to "Último Acesso Gist", add relative time formatting to sub text:
```tsx
<KPICard
  label="Último Acesso Gist"
  value={meta.last_seen_at ? formatDate(meta.last_seen_at) : "Não disponível"}
  sub={meta.last_seen_at ? `atualizado ${formatRelativeTime(meta.last_seen_at)}` : "sem dados"}
/>
```

Add a `formatRelativeTime` helper near `formatDate` that returns "há 2 horas" / "hoje às 14:32" / "há 3 dias" style strings.

**b) Header subtitle (line 424)**: Append sync indicator:
```tsx
slug: {client.slug} · {bindings.length} canais · Atualizado {formatDate(...)} · 🔘 Gist sync: automático (6h)
```

No other files changed.

