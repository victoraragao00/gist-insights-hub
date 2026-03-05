

## Changes to `src/pages/SettingsPage.tsx`

### 1. Warning banner instead of useBlocker

- Add a yellow/amber alert banner at the top of the Sincronização tab when `syncing === true`:
  "⚠ Sincronização em andamento. Não navegue para outra página."
- Add `window.onbeforeunload` via `useEffect` when `syncing` is true (prevents tab close)
- No `useBlocker`, no route blocking

### 2. Status filter for client table

- New state: `statusFilter: "active" | "inactive" | "all"` (default `"active"`)
- Three filter buttons above the table showing counts: `Ativos (N) | Inativos (N) | Todos (N)`
- Filter the displayed `syncClients` list based on `statusFilter`
- Update `selectActive` / `selectAll` / `clearSelection` to work with the filtered list

### 3. Inactivation rule card (above client table)

New `Card` titled "Regra de Inativação Automática":
- Input field: "Inativar clientes sem acesso há mais de [90] dias" (editable number, default 90)
- Button: "Aplicar regra agora"
- On click: calls `supabase.functions.invoke` or `supabase.rpc` — but since we need an UPDATE and RLS doesn't allow client updates, we'll use an edge function approach. However, the user said not to touch edge functions.
- Alternative: Use a direct SQL approach via `supabase.rpc`. We need a database function for this since RLS blocks UPDATE on clients table.

**Database migration needed**: Create a `deactivate_stale_clients` SQL function (SECURITY DEFINER) that:
```sql
CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE clients
  SET active = false
  WHERE active = true
    AND metadata->>'auto_created' = 'true'
    AND (metadata->>'last_seen_at')::timestamptz < NOW() - make_interval(days => _days);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
```

Then in the UI:
```typescript
const { data, error } = await supabase.rpc('deactivate_stale_clients', { _days: inactiveDays });
toast.success(`${data} clientes inativados.`);
```

- State: `inactiveDays: number` (default 90), `applyingRule: boolean`
- Small info text: "Aplica apenas a clientes criados automaticamente (auto_created = true)"

### 4. Files modified

- `src/pages/SettingsPage.tsx` — all UI changes
- Database migration — `deactivate_stale_clients` function

