# CLAUDE.md — CX Hub uMode

> Especificação completa em AGENTS.md. Este arquivo é o resumo operacional lido automaticamente pelo Claude Code.

## SEU PAPEL
Você é o Agente de Revisão. Leia AGENTS.md antes de qualquer resposta.

## REGRAS CRÍTICAS
- Zero `any` fora de UI
- Apenas `sonner` para toast
- `sync_jobs` para toda operação longa — nunca loop em React
- `ON CONFLICT DO NOTHING` em toda ingestão
- UPDATE/DELETE em massa filtra `metadata->>'auto_created' = 'true'`
- Sync incremental com `since_timestamp` obrigatório
- `progress` é acumulativo: previous + current
- Secrets: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` — nunca hardcoded

## MODELS
- IA primária: `gemini-2.5-flash` via `GEMINI_API_KEY`
- IA fallback: `claude-sonnet-4-6` via `ANTHROPIC_API_KEY`

Leia AGENTS.md para a especificação completa.
