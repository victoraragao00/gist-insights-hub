# CONTEXT.md — Estado do Projeto (atualizado 2026-03-07)

> Mantido pelo Claude Code ao final de cada sessão. Lido por todos os agentes para manter contexto.

---

## Estado das Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 0 | Auth (signup/login, RLS) | Concluído |
| 1 | Modelo de dados CX (clients, participants, interactions, sync_jobs) | Concluído |
| 2 | Integrações Gist (proxy, bindings, discover, confirm-mapping) | Concluído |
| 3 | Sync Engine (enqueue + process-jobs worker) | Concluído — issues de refinamento abertas |
| 4 | Classificação IA (classify_batch via Gemini/Claude) | Concluído — safety filter pendente (issue #5) |
| 5 | Dashboard e KPIs | Em progresso — KPIs live do Gist funcionais |
| 6 | Auditorias e Alertas | Placeholder |
| 7 | Insights IA avançados | Placeholder |

---

## Problemas Conhecidos

| # | Issue | Status | Responsável |
|---|-------|--------|-------------|
| #2 | gist-proxy build error (`unknown` error type) | Resolvido (commit `1f03c50`) | Lovable |
| #3 | Gemini logging + safety filter | Parcialmente resolvido — logging OK, safety filter errado | Lovable |
| #4 | Realtime INSERT no ClientContext + Realtime job history | Parcialmente resolvido — SettingsPage OK, INSERT sem filtro | Lovable |
| #5 | classify_batch safety filter deve marcar defaults, não fallback Claude | Aberto | Lovable |
| #6 | INSERT listener deve filtrar por activeJobIds | Aberto | Lovable |

---

## Decisões Técnicas Importantes

### Arquitetura Sync Engine
- **Padrão enqueue → worker:** Edge Functions `sync-gist-contacts` e `ingest-gist-historical` apenas criam jobs via RPC `create_job_if_none_active`. `process-jobs` é o worker genérico que executa.
- **Job types:** `sync_contacts`, `ingest_historical`, `classify_batch`
- **Auto-chain:** Quando `has_more: true`, o worker dispara nova invocação de si mesmo (fire-and-forget). `pg_cron` via `schedule-sync` é rede de segurança.
- **Polling fallback mantido:** O `setInterval` de 30s no `ClientContext` foi mantido como rede de segurança para quando Realtime desconectar.

### IA / Classificação
- **Primária:** `gemini-2.5-flash` via `GEMINI_API_KEY`
- **Fallback:** `claude-sonnet-4` via `CLAUDE_API_KEY`
- **Safety filter (pendente issue #5):** Quando Gemini bloqueia por safety, marcar com defaults em vez de gastar chamada no Claude.

### Colaboração Claude Code + Lovable
- **Claude Code:** code reviews, refactors, testes, docs, scripts utilitários
- **Lovable:** migrations, edge functions, componentes UI, deploy
- **Nunca editar:** `src/integrations/supabase/*`, `supabase/config.toml`, `.env`, `supabase/migrations/*`
- **Workflow:** Claude Code cria GitHub Issues com código → Lovable implementa

---

## Próximos Passos Prioritários

1. **Lovable:** Resolver issues #5 e #6 (safety filter + INSERT filter)
2. **Lovable:** Deploy das edge functions corrigidas (`process-jobs`)
3. **Geral:** Verificar se `GEMINI_API_KEY` está configurada nos secrets do Supabase (estava falhando)
4. **Geral:** Rodar classify_batch até zerar backlog de interações não classificadas
5. **Fase 5:** Avançar dashboard com dados classificados (temas, tons, sentimentos)
