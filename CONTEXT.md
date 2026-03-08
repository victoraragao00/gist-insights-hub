# CONTEXT.md — Estado do Projeto (v11 — 2026-03-08)

> Mantido pelo Claude Code ao final de cada sessao. Lido por todos os agentes para manter contexto.
>
> last_updated: 2026-03-08
> last_updated_by: Claude Code

---

## Estado das Fases

| Fase | Descricao | Status |
|------|-----------|--------|
| 0 | Auth (signup/login, RLS) | Concluido |
| 1 | Modelo de dados CX (clients, participants, interactions, sync_jobs) | Concluido |
| 2 | Integracoes Gist (proxy, bindings, discover, confirm-mapping) | Concluido |
| 3 | Sync Engine (enqueue + process-jobs worker) | Concluido |
| 4 | Classificacao IA (classify_batch via Gemini/Claude) | Concluido — Gemini Pro + prompt Mega Agente v6 |
| 5 | Priority Score Engine + Dashboard | Backend concluido (Issue #32), Frontend em andamento (Issue #33) |
| 6 | Auditorias e Alertas | Placeholder |
| 7 | Insights IA avancados | Placeholder |

---

## Fase 5 — Priority Score Engine

### Backend (Issue #32 — Lovable — Concluido)

- **Migration:** ENUM `client_tier` + tabelas `client_priority_config` e `priority_scores` com RLS
- **Edge Function:** `calculate-priority-scores` — modular (6 funcoes puras em `logic.ts`), env-driven (`PRIORITY_*`), auth JWT+admin, batch+auto-chain
- **Event-driven:** `process-jobs` dispara calculo apos `classify_batch` completar (fire-and-forget)
- **pg_cron:** schedule a cada 2h como safety net
- **Seed:** 13 clientes configurados (By NV=azzas, Osklen=enterprise, restante=medium)
- **Testes:** 9 casos unitarios para `calculateScore` (4) e `detectPatterns` (5) em `index.test.ts`
- **Score inicial:** By NV score=296 com 3 padroes detectados, demais com score=0
- **Correcoes aplicadas:** bug severity (worst_tone preservado), YAGNI force removido, testes adicionados
- **types.ts:** regenerado com `client_priority_config`, `priority_scores`, `client_tier`

### Frontend (Issue #33 — Cursor — Em andamento)

- **PR1 (UX fixes):** pode iniciar imediatamente — remover 17 "Em breve", fix saude invertida, "Hub Central" -> "CX Hub", deletar useGistKPIs.ts
- **PR2 (Dashboard):** aguarda confirmacao de types.ts — hooks (useUserRole, usePriorityScores, useRecalculatePriority), Dashboard com ranking, tier badges, patterns, score visual (cap 100), admin features
- **Design System:** `docs/DESIGN_SYSTEM.md` criado como fonte unica de verdade para cores, motion, componentes
- **Cursor Rules:** `.cursor/rules` atualizado com Design System, proibicoes explicitas, stack completa
- **Animacoes:** 5 keyframes custom registrados no `tailwind.config.ts` (pulse-subtle, fade-in-up, shimmer, progress-fill, score-pop)

### Env vars declaradas no Supabase

```
PRIORITY_SEVERITY_CRITICO=10
PRIORITY_SEVERITY_ALERTA=5
PRIORITY_SEVERITY_ATENCAO=2
PRIORITY_RECENCY_RECENT_DAYS=3
PRIORITY_RECENCY_MEDIUM_DAYS=7
PRIORITY_RECENCY_RECENT_MULTIPLIER=2.0
PRIORITY_RECENCY_MEDIUM_MULTIPLIER=1.5
PRIORITY_RECENCY_BASE_MULTIPLIER=1.0
PRIORITY_BATCH_SIZE=20
```

---

## Reclassificacao do Backlog

- **Status:** Concluido (100% da janela de 365 dias)
- **Classificadas:** 21.262 msgs (todas dentro da janela de 365d)
- **Nao classificadas:** 11.829 msgs (historicas com occurred_at > 1 ano, fora do escopo)
- **Jobs executados:** 6 classify_batch (Gemini Pro + v6)
- **Modelo:** gemini-2.5-pro, 4 timeouts de Gemini (normal)
- **Custo total backlog:** ~$2.22

---

## Issues

| # | Issue | Status | Responsavel |
|---|-------|--------|-------------|
| #2-#10 | Bugs iniciais (proxy, safety filter, realtime, timeouts, attachments) | Resolvidos | Lovable |
| #11 | Migration: conversation_id column + backfill + index | Resolvido | Lovable |
| #12 | classify_batch por conversa (nao por mensagem isolada) | Resolvido | Lovable |
| #13 | Banner de reclassificacao (opcional) | Aberto | Lovable |
| #14 | Calibracao de tom + filtro 365d | Resolvido | Lovable |
| #15 | Prompt Mega Agente v3 | Resolvido | Lovable |
| #16 | Gemini Pro definitivo + prompt v6 com few-shot examples | Resolvido | Lovable |
| #17 | m3: Remove unused toast files | Resolvido (PR #23) | Cursor |
| #18 | m1: Replace `any` types in non-UI code | Resolvido (PR #26) | Cursor |
| #19 | m4+m5: Fix staleTime and queryKey | Resolvido (PR #24) | Cursor |
| #20 | m9: Replace useState with useMutation | Resolvido (PR #27) | Cursor |
| #21 | m12: Add real pagination | Resolvido (PR #28) | Cursor |
| #22 | m6: Replace static DOM IDs with useId | Resolvido (PR #25) | Cursor |
| #29 | m9: handleToggleRule sem useMutation | Resolvido (PR #31) | Cursor |
| #30 | UX: NotFound em ingles | Resolvido (PR #31) | Cursor |
| #32 | Fase 5: Priority Score Engine backend | Concluido | Lovable |
| #33 | Fase 5: Priority Dashboard + UX cleanup | Em andamento | Cursor |

---

## Divida Tecnica (auditoria Cursor — 2026-03-08)

**Status: Resolvida** — Todas as 7 violacoes corrigidas pelo Cursor e revisadas pelo Claude Code.

| Item | Problema | Status |
|------|----------|--------|
| m1 | `any` em codigo nao-UI | Resolvido — PR #26 |
| m3 | toast files nao usados | Resolvido — PR #23 |
| m4 | staleTime ausente em 6 queries | Resolvido — PR #24 |
| m5 | invalidateQueries sem `user?.id` | Resolvido — PR #24 |
| m6 | DOM IDs estaticos | Resolvido — PR #25 |
| m9 | useState manual para escrita | Resolvido — PR #27 + PR #31 |
| m12 | Sem paginacao real | Resolvido — PR #28 |

## Problemas de UX identificados

- ~~Dashboard mostra KPIs do Gist mas nao reflete dados de classificacao IA~~ — Issue #33 PR2
- ~~Excesso de botoes "Em breve" — transmite produto inacabado~~ — Issue #33 PR1
- Pagina Auditorias e placeholder sem funcionalidade
- ~~Coluna "Saude" com semantica invertida~~ — Issue #33 PR1
- ~~Marca inconsistente (Login diz "Hub Central", sidebar diz "uMode")~~ — Issue #33 PR1
- ~~404 em ingles, app em PT-BR~~ — Resolvido (PR #31)

---

## Arquitetura

### Sync Engine
- **Padrao enqueue -> worker:** Edge Functions criam jobs via RPC `create_job_if_none_active`. `process-jobs` e o worker generico.
- **Job types:** `sync_contacts`, `ingest_historical`, `classify_batch`
- **Auto-chain:** `has_more: true` dispara nova invocacao. `pg_cron` e rede de seguranca.

### IA / Classificacao (v6 — Mega Agente + Gemini Pro)
- **Modelo definitivo:** `gemini-2.5-pro` (custo ~$2/ano, qualidade superior)
- **Fallback:** `claude-sonnet-4` via `CLAUDE_API_KEY`
- **Unidade de classificacao:** conversa (thread completa), nao mensagem isolada
- **Coluna `conversation_id`:** materializada, indexada
- **Batch:** 10 conversas/batch (~200 msgs), propagacao para todas as mensagens
- **Prompt Mega Agente:** contexto uMode (B2B textil/moda), rubrica de tom 4 niveis, 8 regras anti-vies, desambiguacao de 14 temas, 4 few-shot examples
- **Filtro temporal:** 365 dias
- **Safety filter:** marca defaults com `gemini-safety-default`
- **Timeout:** 55s Gemini, 45s Claude
- **JSON recovery:** `parseWithRecovery()`
- **Auto-chain limit:** `MAX_BATCHES_PER_JOB = 50`

### Priority Score Engine (Fase 5)
- **Edge Function:** `calculate-priority-scores` — modular, 6 funcoes, logica pura em `logic.ts`
- **Score:** `Σ(user_count × severityWeight[worst_tone] × recencyWeight) × weight_multiplier`
- **Sem cap no banco** — cap visual de 100 e responsabilidade do frontend
- **Triggers:** manual (POST com JWT admin), pg_cron (2h), event-driven (apos classify_batch)
- **Testes:** 9 unitarios para calculateScore e detectPatterns
- **Env vars:** 9 variaveis `PRIORITY_*` configuradas no Supabase Dashboard

### Design System (docs/DESIGN_SYSTEM.md)
- **Paleta semantica:** tom (emerald/yellow/orange/red), tier (primary/blue/slate/gray), score (emerald/yellow/orange/red), severity (red/yellow/emerald), saude (emerald/yellow/orange/red)
- **Motion patterns:** 5 keyframes custom no tailwind.config.ts + tailwindcss-animate ja instalado
- **Regras de decisao:** overlay (AlertDialog/Dialog/Sheet), feedback (toast/Alert), listas (Cards/Table/Pagination)
- **Proibicoes:** 10 regras explicitas no .cursor/rules

### Auditoria de Qualidade (blind tests com 32 conversas)

| Versao | Modelo | Prompt | Nota | Tom | Tema |
|--------|--------|--------|------|-----|------|
| v2 | Flash | Original | 7.9 | 52% | 79% |
| v3 | Flash | Mega Agente | 8.8 | 75% | 84% |
| v4 | Claude Sonnet (cego) | Mega Agente | 8.6 | 72% | 78% |
| v5 | Pro | Mega Agente | 8.8 | 81% | 81% |
| **v6** | **Pro** | **Mega Agente + few-shot** | **9.0** | **84%** | **84%** |

**Conclusao:** Gemini Pro + Mega Agente v6 e a versao definitiva. Nota 9.0/10, primeiro acima de 9. Claude performou pior com o mesmo prompt (8.6). Custo mensal ~$0.16.

### Volume e Custos
- **Backlog:** ~33k msgs em ~1.680 conversas (100% classificado dentro da janela de 365d)
- **Volume mensal:** ~117 conversas/mes (media ultimos 6 meses, tendencia crescente)
- **Custo Gemini Pro:** ~$2.22 backlog + ~$0.16/mes recorrente (~$2/ano)

---

## Colaboracao

Papeis, restricoes, fluxos e checklist completos em AGENTS.md (v7).

| Agente | Papel | Canal |
|--------|-------|-------|
| **Claude Code** | Revisao e Engenharia | Terminal / CLI |
| **Cursor** | Desenvolvimento Frontend | Cursor IDE |
| **Lovable** | Migrations e Edge Functions (escopo reduzido) | Interface Lovable |
| **Projeto** | Auditoria e Estrategia | claude.ai |
| **Operador** (Joao) | Orquestrador Humano | Supabase Dashboard / GitHub |

### Mudanca de estrategia (2026-03-08)
- **Cursor assumiu o frontend** para reduzir dependencia e custo do Lovable
- **Lovable fica restrito** a migrations, edge functions e deploy no Supabase
- **Claude Code revisa** todo codigo do Cursor contra Checklist do CTO
- **Plano de independencia:** migrar ownership do Supabase project para conta propria (futuro)

### Preferencias do Operador
- Respostas diretas e concisas — sem enrolacao
- Conteudo self-contained para copy-paste — nunca pedir para intermediar
- Nao dar estimativas de tempo — focar no que precisa ser feito
- Arquivos compartilhados em `~/Desktop/CX HUB/`
- Repo publico: github.com/HyTrackWater/gist-insights-hub

---

## Proximos Passos

1. **Concluido:** Reclassificacao do backlog (100% da janela 365d, 6 jobs, ~$2.22)
2. **Concluido:** Divida tecnica do Checklist CTO (m1, m3, m4, m5, m6, m9, m12) — 8 PRs mergeados
3. **Concluido:** Fase 5 backend — Priority Score Engine (Issue #32, Lovable)
4. **Em andamento:** Fase 5 frontend — Priority Dashboard + UX cleanup (Issue #33, Cursor)
5. **Proximo:** Limpar pagina Auditorias (placeholder)
6. **Fase 6:** Auditorias e Alertas
7. **Fase 7:** Insights IA avancados
