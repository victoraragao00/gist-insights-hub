

## Disparar backlog completo de classify_batch

### Passos

1. **Cancelar jobs ativos** — UPDATE em `sync_jobs` onde `type='classify_batch'` e `status IN ('pending','running')` → `status='cancelled', completed_at=now()`

2. **Limpar classificações inválidas** — Resetar `classified_at=NULL` em interactions que ainda tenham themes inválidos do run anterior (se houver)

3. **Criar job novo** — Usar RPC `create_job_if_none_active('classify_batch', NULL, '{}')` para inserir job pendente

4. **Disparar process-jobs** — POST via `curl_edge_functions` para iniciar processamento imediato; auto-chain cuida do resto

### Estimativa

~29.000 interações ÷ 20 por batch = ~1.450 batches. Com ~2-3s por batch (Gemini Flash), estimativa de ~1-1.5h para completar o backlog inteiro.

