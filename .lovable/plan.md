

## Fix: Watcher Toggle Duplicate Key Error (23505)

### Root cause
The `useToggleWatcher` invalidates queryKey `["demand_watchers", demandId]` but the query in `useDemandWatchers` uses `["demand_watchers", user?.id, demandId]`. The partial key doesn't match, so the cache never refreshes after a toggle. The UI stays showing "Observar" even after inserting, leading to a second insert attempt and error 23505.

### Fix (1 line change)
**File:** `src/hooks/useDemandWatchers.ts` line 68

Change the invalidation to use a partial match that covers the full key:

```typescript
// Before
queryClient.invalidateQueries({ queryKey: ["demand_watchers", demandId] });

// After  
queryClient.invalidateQueries({ queryKey: ["demand_watchers"] });
```

Using just `["demand_watchers"]` as a prefix will match any query starting with `"demand_watchers"`, including the one with `user?.id`. This is the standard React Query pattern for partial invalidation.

### No other changes needed
- The `isWatching` derivation in `DemandDetailSheet.tsx` line 269 is correct
- The button rendering (line 876-882) is correct
- The watcher list display with names (lines 884-900) is correct
- The hook toggle logic (insert/delete) is correct

### Files changed
- **Edit:** `src/hooks/useDemandWatchers.ts` (line 68 only)

