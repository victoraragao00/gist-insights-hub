

## Progresso granular + tempo decorrido

### Mudanças em `src/context/ClientContext.tsx`

**1. Renomear `estimatedRemaining` → `elapsedDisplay` no `SyncState`**

Replace ETA with elapsed time. The `formatEta` helper becomes `formatElapsed`:
```typescript
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec}s`;
}
```

**2. `updateProgress` accepts `subProgress` fraction + shows elapsed time**

```typescript
const updateProgress = (currentName: string, stepIndex: number, subProgress = 0) => {
  const basePct = (completedSteps / totalSteps) * 100;
  const stepPct = (1 / totalSteps) * 100;
  const pct = Math.round(basePct + stepPct * Math.min(subProgress, 0.95));
  const elapsed = Date.now() - startedAt;

  setSyncState((prev) => ({
    ...prev,
    currentClientName: currentName,
    currentClientIndex: completedSteps + 1,
    progressPct: pct,
    elapsedDisplay: `Em andamento há ${formatElapsed(elapsed)}`,
    completedResults: [...results],
  }));
};
```

**3. Contacts loop — denominator from `total_pages` or 31**

Inside the `while (hasMore)` loop for contacts:
```typescript
let pageCount = 0;
let denominator = 31; // default
while (hasMore && !cancelledRef.current) {
  const { data, error } = await supabase.functions.invoke(...);
  if (data?.result?.total_pages) denominator = data.result.total_pages;
  pageCount++;
  updateProgress("Contatos (global)", 0, Math.min(pageCount / denominator, 0.95));
  // ...
}
```

**4. History loop — denominator = 5 (max_pages per invocation)**

```typescript
let pageCount = 0;
while (hasMore && !cancelledRef.current) {
  // ... invoke ...
  pageCount++;
  updateProgress(client.name, contactsStep + i, Math.min(pageCount / 5, 0.95));
}
```

### Mudanças em `src/components/DashboardLayout.tsx`

Replace the `estimatedRemaining` display with `elapsedDisplay`:
```
— Em andamento há 2min 34s
```
Line 30-34: change from `syncState.estimatedRemaining` to `syncState.elapsedDisplay`.

### Mudanças na interface `SyncState`

- `estimatedRemaining: string | null` → `elapsedDisplay: string | null`
- Update `INITIAL_SYNC_STATE` accordingly
- Update final state reset to set `elapsedDisplay: null`

### Files modified
- `src/context/ClientContext.tsx`
- `src/components/DashboardLayout.tsx`

