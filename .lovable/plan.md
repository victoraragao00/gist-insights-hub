

## Correção: Progress Acumulativo no `handleClassifyBatch`

### Análise

O main loop (L644-650) persiste `result.progress` diretamente no job a cada auto-chain. Se o handler retornar `{ classified: 5 }` em cada batch, o progress será sobrescrito — perdendo o total acumulado.

Os outros handlers (`handleSyncContacts`, `handleIngestHistorical`) não têm esse problema porque usam contadores diferentes ou completam em um batch. Para `classify_batch` com ~1,470 batches, a acumulação é essencial.

### Correção no handler

Dentro de `handleClassifyBatch`, antes do return:

```typescript
const previousClassified = (job.progress as any)?.classified ?? 0;

return {
  has_more: rows.length === 20,
  progress: {
    classified: previousClassified + classifiedCount,
    model_used,
  },
};
```

Isso garante que cada batch soma ao total anterior. O main loop persiste `result.progress` no job (L649), e na próxima iteração o handler lê `job.progress.classified` já acumulado.

### Nenhuma outra alteração

O main loop não precisa de mudança — ele já persiste `result.progress` tal qual. A responsabilidade de acumular fica no handler.

### Plano completo atualizado

Incorporar esta correção ao `handleClassifyBatch` na implementação. Os 3 arquivos a alterar permanecem os mesmos:

1. `process-jobs/index.ts` — novo `handleClassifyBatch` (com progress acumulativo) + case no switch
2. `schedule-sync/index.ts` — adicionar `'classify_batch'` ao array

