

## Plano: Corrigir Labels e Progresso do Sync Bar

### Problema
1. `ClientContext.tsx` linha 91 usa lógica binária (`sync_contacts` vs "todo o resto = Histórico"), causando label errado para `classify_batch` e `transcribe_audio`
2. `computeJobProgress()` só entende `next_page/total_pages` — não calcula progresso para `classify_batch` (que usa `batches_processed/conversations_processed`)
3. O `schedule-sync` cria jobs de `classify_batch` que o frontend não reconhece, mas detecta como "ativos" e exibe com informações incorretas

### Solução

**Arquivo: `src/context/ClientContext.tsx`**

1. **Mapa de labels** — substituir o ternário por um map completo:
```typescript
const JOB_LABELS: Record<string, string> = {
  sync_contacts: 'Contatos (global)',
  ingest_historical: 'Histórico (global)',
  classify_batch: 'Classificação IA',
  transcribe_audio: 'Transcrição',
};
currentLabel = JOB_LABELS[activeJob.type] ?? activeJob.type;
```

2. **Progresso por tipo** — adaptar `computeJobProgress()` para entender cada job type:
   - `classify_batch`: usar `conversations_processed` vs total estimado (ou `batches_processed` como indicador)
   - `ingest_historical` / `sync_contacts`: manter lógica atual (`next_page/total_pages`)
   - Fallback genérico para tipos desconhecidos

3. **Sem impacto funcional** — apenas correção visual. Nenhuma alteração no backend, edge functions ou fluxo de sync.

### Arquivos alterados
- `src/context/ClientContext.tsx` (labels + progresso)

### Verificação
- Enquanto `classify_batch` roda, a barra deve mostrar "Classificação IA — X%" com progresso baseado em `conversations_processed`

