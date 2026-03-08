# CONTEXT.md — Estado do Projeto (v17 — 2026-03-08)

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
| 5 | Priority Score Engine + Dashboard | Concluido — Backend (Issue #32) + Frontend (Issue #33, PRs #34 e #35) |
| 6 | Auditorias e Alertas | Concluido — Backend (Issues #37-#38 + Lovable S1-S5) + Frontend (PRs #51-#53) |
| 6.5 | Campo status em clients (controle manual) | Concluido — Backend (Issue #54, Lovable S7) + Frontend (PRs #57-#58) |
| 6.6 | Sprint P1+P3+P4 (edicao cliente + CRUD rules + busca server-side) | Concluido — PRs #61, #62, #64 |
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

### Frontend (Issue #33 — Cursor — Concluido)

- **PR #34 (UX fixes):** 17 "Em breve" removidos, getHealthColor corrigido (Design System 1.5), "Hub Central" -> "CX Hub", useGistKPIs.ts deletado, DropdownMenu vazio corrigido
- **PR #35 (Dashboard):** Priority Dashboard com ranking por score, tier badges, patterns expandiveis, score cap visual 100, admin features (recalcular, clientes sem config), viewer read-only, empty/loading/error states, dark mode, mobile responsive
- **Hooks criados:** useUserRole (role/isAdmin), usePriorityScores (two queries + merge), useRecalculatePriority (useMutation)
- **Testes:** 5 testes (score cap + role logic)
- **Animacoes usadas:** fade-in-up (stagger), score-pop, progress-fill, pulse-subtle (score>=80), shimmer
- **Design System:** `docs/DESIGN_SYSTEM.md` criado como fonte unica de verdade para cores, motion, componentes
- **Cursor Rules:** `.cursor/rules` atualizado com Design System, proibicoes explicitas, stack completa
- **Keyframes custom:** 5 registrados no `tailwind.config.ts` (pulse-subtle, fade-in-up, shimmer, progress-fill, score-pop)

### Auditoria UX/UI — 12 PRs do Cursor (todos mergeados)

| PR | Titulo | LOTE | Arquivos |
|----|--------|------|----------|
| #39 | fix: error states in ClientsPage and ClientDetailPage | 1 | ClientsPage, ClientDetailPage |
| #40 | fix: replace manual submitting state with useMutation in auth pages | 1 | LoginPage, SignupPage |
| #41 | fix: honest empty state for Audits page | 1 | Audits |
| #42 | fix: use React Router Link in NotFound page | 1 | NotFound |
| #43 | feat: Settings priorities tab + jobStatusBadge dark mode | 1 | SettingsPage, useClientPriorityConfig (novo) |
| #44 | fix: dark mode tone/status colors, shimmer skeletons, layout padding | 2 | ClientsPage, ClientDetailPage, DashboardLayout |
| #45 | fix: accessibility aria-labels, focus-visible, active:scale | 3 | ClientsPage, ClientDetailPage |
| #46 | feat: score column in ClientsPage | 4 | ClientsPage |
| #47 | feat: Dashboard search by name and filter by tier | 4 | Index |
| #48 | feat: ClientDetail score card and remove Tasks tab | 4 | ClientDetailPage |
| #49 | feat: recharts volume chart in ClientDetail | 5 | ClientDetailPage |
| #50 | feat: Dashboard global KPIs and trend charts | 5 | Index, useGlobalStats (novo) |
| #51 | feat: Audits page with real alerts | 6-FE | Audits, useAuditAlerts (novo) |
| #52 | feat: global search page | 6-FE | SearchPage (novo), useSearchInteractions (novo), App, AppSidebar |
| #53 | feat: tone trend 7d chart | 6-FE | ClientDetailPage, useClientToneTrend (novo) |

**Hooks adicionados (auditoria UX + Fase 6 frontend):**
- `useClientPriorityConfig` — config de prioridades para aba Settings (PR #43)
- `useGlobalStats` — chama `global_stats_30d` RPC para KPI cards e graficos (PR #50)
- `useAuditAlerts` — chama `audit_alerts_summary` para pagina Auditorias (PR #51)
- `useSearchInteractions` — chama `search_interactions` para busca global (PR #52)
- `useClientToneTrend` — chama `client_tone_trend_7d` para grafico de tendencia (PR #53)

**Paginas e componentes adicionados:**
- `SearchPage.tsx` — busca full-text com debounce, filtros por cliente/tom, paginacao real (PR #52)
- `Audits.tsx` — reescrito: KPI cards, tabela de alertas, empty/loading/error states (PR #51)
- ClientDetailPage: recharts BarChart volume 14d (PR #49), stacked BarChart tom 7d (PR #53)
- Index: 4 KPI cards, stacked BarChart evolucao tom, horizontal BarChart top temas, BarChart score, PieChart tier (PR #50)
- Rota `/search` registrada em App.tsx, item "Busca" no AppSidebar (PR #52)

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
AUDIT_BATCH_SIZE=20
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
| #33 | Fase 5: Priority Dashboard + UX cleanup | Concluido (PR #34 + PR #35) | Cursor |
| #37 | DB function global_stats_30d para Dashboard KPIs | Concluido (commits 345c497 + 4d977d7) | Lovable |
| #38 | Edge function evaluate-audit-rules — alertas automaticos | Concluido (commits e44bd75 + 30c2775 + 7dbc62c) | Lovable |
| #39 | fix: error states in ClientsPage and ClientDetailPage | Mergeado | Cursor |
| #40 | fix: auth useMutation | Mergeado | Cursor |
| #41 | fix: Audits empty state honesto | Mergeado | Cursor |
| #42 | fix: NotFound React Router Link | Mergeado | Cursor |
| #43 | feat: Settings priorities tab + jobStatusBadge dark mode | Mergeado | Cursor |
| #44 | fix: dark mode tone/status colors, shimmer, layout padding | Mergeado | Cursor |
| #45 | fix: accessibility aria-labels, focus-visible | Mergeado | Cursor |
| #46 | feat: score column in ClientsPage | Mergeado | Cursor |
| #47 | feat: Dashboard search + tier filter | Mergeado | Cursor |
| #48 | feat: ClientDetail score card, remove Tasks tab | Mergeado | Cursor |
| #49 | feat: recharts volume chart in ClientDetail | Mergeado | Cursor |
| #50 | feat: Dashboard global KPIs and trend charts | Mergeado | Cursor |
| #51 | feat: Audits page with real alerts from audit_alerts_summary | Mergeado | Cursor |
| #52 | feat: global search page with search_interactions | Mergeado | Cursor |
| #53 | feat: tone trend 7d chart in ClientDetailPage | Mergeado | Cursor |
| #54 | feat(db): adicionar coluna status em clients | Concluido | Lovable |
| #55 | feat(ui): filtro de status e badge na ClientsPage | Mergeado (PR #57) | Cursor |
| #56 | feat(ui): badge de status no ClientDetailPage | Mergeado (PR #58) | Cursor |
| #59 | feat(ui): edicao de cliente na tab Configuracoes | Mergeado (PR #61) | Cursor |
| #60 | feat(ui): CRUD de audit_rules na pagina Auditorias | Mergeado (PR #62) | Cursor |
| #63 | fix: busca server-side em ClientsPage, SearchPage e Dashboard | Mergeado (PR #64) | Cursor |

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

- ~~Dashboard mostra KPIs do Gist mas nao reflete dados de classificacao IA~~ — Resolvido (PR #35 + PR #50)
- ~~Excesso de botoes "Em breve" — transmite produto inacabado~~ — Resolvido (PR #34)
- ~~Pagina Auditorias e placeholder sem funcionalidade~~ — Resolvido: empty state (PR #41) + UI real com alertas (PR #51)
- ~~Coluna "Saude" com semantica invertida~~ — Resolvido (PR #34)
- ~~Marca inconsistente (Login diz "Hub Central", sidebar diz "uMode")~~ — Resolvido (PR #34)
- ~~404 em ingles, app em PT-BR~~ — Resolvido (PR #31)
- ~~Dark mode incompleto (TONE_CONFIG, badges, jobStatusBadge)~~ — Resolvido (PR #44 + PR #43)
- ~~Skeletons sem shimmer~~ — Resolvido (PR #44)
- ~~Layout padding fixo (sem responsivo)~~ — Resolvido (PR #44)
- ~~Acessibilidade (aria-labels, focus-visible, keyboard nav)~~ — Resolvido (PR #45)
- ~~Score nao visivel em ClientsPage~~ — Resolvido (PR #46)
- ~~Dashboard sem busca/filtro~~ — Resolvido (PR #47)
- ~~ClientDetail sem score card, com aba Tasks morta~~ — Resolvido (PR #48)
- ~~Grafico de volume em divs manuais~~ — Resolvido com recharts (PR #49)
- ~~Dashboard sem KPIs globais e graficos de tendencia~~ — Resolvido (PR #50)

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
- **Chain:** apos completar (!hasMore), dispara `evaluate-audit-rules` (fire-and-forget)

### Auditorias e Alertas (Fase 6 — backend completo)

#### RLS Policies (Lovable S1)
- **audit_rules:** SELECT para todos com acesso, INSERT/UPDATE/DELETE apenas admin
- **audit_alerts:** SELECT only (INSERT via service_role na Edge Function)
- `user_accessible_client_ids()` retorna `SETOF uuid` — nao requer `unnest()`

#### Seed + Realtime + pg_cron (Lovable S2)
- **Seed:** 39 regras (3 metricas x 13 clientes ativos): score_prioridade>=80, tom_critico_pct>=15, volume_periodo>=50
- **Unique constraint:** `audit_rules_client_metric_unique` (client_id, metric)
- **Realtime:** `audit_alerts` adicionado ao `supabase_realtime` publication
- **pg_cron:** `evaluate-audit-rules` a cada 2h (minuto :15)

#### DB Function: `audit_alerts_summary` (Lovable S3)
- **Retorna:** total_alerts_30d, unread_count, alerts (jsonb array, top 50)
- **Coluna `read`:** adicionada a `audit_alerts` (bool, default false)
- **Joins:** audit_alerts + audit_rules + clients (para nomes)
- **Desbloqueia:** Auditorias UI real (Cursor)

#### DB Function: `search_interactions` (Lovable S4)
- **Full-text search:** `search_vector @@ plainto_tsquery('portuguese', p_query)` com `ts_rank`
- **Filtros opcionais:** p_client_id, p_tone
- **Paginacao:** `COUNT(*) OVER()`, p_limit=20, p_offset=0
- **Desbloqueia:** Pagina de busca global (Cursor)

#### DB Function: `client_tone_trend_7d` (Lovable S5)
- **Retorna:** 7 rows (1 por dia), colunas ok/atencao/alerta/critico
- **Index-friendly:** `occurred_at >= d.day AND occurred_at < d.day + interval '1 day'`
- **Desbloqueia:** Grafico de tendencia na ClientDetailPage (Cursor)

#### DB Function: `global_stats_30d` (Issue #37)
- **Retorna:** total_interactions_30d, pct_critico, pct_alerta, total_clients_monitored, monthly_tone_evolution (6 meses), top_themes (top 5)
- **SQL puro** (LANGUAGE sql, STABLE, SECURITY DEFINER)
- **RLS:** filtra via `user_accessible_client_ids(p_user_id)`
- **Janelas:** 30 dias para totais, 6 meses para evolucao
- **Desbloqueia:** PR-H2 (Dashboard KPI cards + graficos) — Cursor

#### Edge Function: `evaluate-audit-rules` (Issue #38)
- **Estrutura modular:** index.ts (handler), logic.ts (funcoes puras), index.test.ts (9 testes), README.md
- **Metricas:** score_prioridade, tom_critico_pct, tom_alerta_pct, volume_periodo
- **Fluxo:** fetchActiveRules → calculateMetric → evaluateRule → checkCooldown → insertAlert
- **Batch + auto-chain:** AUDIT_BATCH_SIZE=20, fire-and-forget
- **Trigger:** encadeado apos calculate-priority-scores (!hasMore)
- **Auth:** service_role_key only
- **Desbloqueia:** Auditorias UI real (Cursor, futuro)

### Campo `status` em `clients` (Fase 6.5 — Sessao 7)
- **Coluna:** `status TEXT NOT NULL DEFAULT 'ativo'` com CHECK `('ativo','inativo','trial')`
- **Controle:** 100% manual (Operador). Nunca alterado por sync, edge function ou cron
- **Independente de `active`:** `active` continua para uso interno do sync (process-jobs L343 seta `active=false` apos 90d stale em `auto_created`)
- **Frontend:** filtro default `.in("status", ["ativo", "trial"])` com toggle "Incluir inativos"
- **Badge:** ativo=emerald, trial=blue, inativo=slate (com dark mode pairs)
- **Banner:** clientes inativos mostram "Este cliente esta inativo. Interacoes continuam sendo processadas normalmente."
- **Arquivos alterados:** ClientsPage, SearchPage, SettingsPage, GistContactWizard, ClientDetailPage
- **Populacao inicial:** active=true→ativo (104), active=false→inativo (130)

### Sprint P1: Edicao de cliente (Issue #59, PR #61)
- **Tab Configuracoes** em ClientDetailPage: formulario com nome, status, scope, tier
- **Admin:** campos editaveis + botao Salvar. **Viewer:** read-only
- **saveClientMutation:** atualiza `clients` (name, status, metadata.scope) + upsert `client_priority_config` (tier)
- **Scope movido** da tab "Regras de Negocio" para "Configuracoes"
- **Invalida:** client_detail, clients_list, client_priority_config, priority-scores

### Sprint P3: CRUD de audit_rules (Issue #60, PR #62)
- **Tabs** em Audits.tsx: "Alertas" (conteudo existente) + "Regras" (novo)
- **Hook:** `useAuditRules` — paginado (PAGE_SIZE=20), join `clients(name)`, staleTime 30s
- **4 operacoes:** create, update, delete (AlertDialog), toggle active (Switch)
- **Dialog** com 10 campos incluindo destinatarios dinamicos (adicionar/remover)
- **METRIC_CONFIG:** 11 metricas com labels legiveis em pt-BR
- **Constraint duplicata:** tratada com toast amigavel
- **Admin:** todas as acoes. **Viewer:** tabela read-only

### Sprint P4: Busca server-side (Issue #63, PR #64)
- **Hook:** `useDebounce<T>(value, delay)` — novo, compartilhado entre 3 telas
- **ClientsPage:** `.ilike("name")` server-side, queryKey com termo, reset page=0, staleTime dinamico
- **SearchPage:** debounce inline substituido por hook + secao "Clientes" (max 5, com Link e badge status) acima de "Interacoes"
- **Dashboard:** debounce 300ms no filtro existente (client-side mantido para ~13 registros)
- **Regra:** minimo 3 chars para disparar busca, debounce 300ms em todas as telas

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

Papeis, restricoes, fluxos e checklist completos em AGENTS.md (v8).

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
4. **Concluido:** Fase 5 frontend — Priority Dashboard + UX cleanup (Issue #33, Cursor, PRs #34 e #35)
5. **Concluido:** Fase 6 backend — global_stats_30d (Issue #37) + evaluate-audit-rules (Issue #38), Lovable
6. **Concluido:** Auditoria UX/UI — 12 PRs do Cursor mergeados (#39-#50), organizados em 5 LOTEs
   - LOTE 1: PR-A1 (#39), PR-C (#40), PR-D (#41), PR-E (#42), PR-F (#43)
   - LOTE 2: PR-A2 (#44)
   - LOTE 3: PR-B (#45)
   - LOTE 4: PR-G (#46), PR-H1 (#47), PR-I (#48)
   - LOTE 5: PR-J (#49), PR-H2 (#50)
   - Frontend Contracts: regra adicionada ao AGENTS.md — Lovable inclui contratos tipados em Issues que desbloqueiam Cursor
7. **Concluido:** Lovable Marathon — 5 sessoes executadas com sucesso (S1-S5)
   - Sessao 1: RLS policies audit_rules + audit_alerts
   - Sessao 2: 39 regras seedadas, unique constraint, realtime, pg_cron */2h
   - Sessao 3: DB function audit_alerts_summary + coluna read
   - Sessao 4: DB function search_interactions (full-text + paginacao)
   - Sessao 5: DB function client_tone_trend_7d (7 dias, LEFT JOIN)
   - Sessao 6: Edge function deliver-audit-alerts — adiada, baixa prioridade
   - Nota tecnica: `user_accessible_client_ids()` retorna `SETOF uuid`, nao `uuid[]`
8. **Concluido:** Fase 6 frontend — 3 PRs do Cursor mergeados (#51-#53)
   - PR #51: Audits UI real (KPIs, tabela alertas, empty/loading/error states)
   - PR #52: SearchPage (busca global full-text, filtros, paginacao, rota /search, sidebar)
   - PR #53: Tone trend 7d chart em ClientDetailPage (stacked BarChart)
9. **Concluido:** Sessao 7 — Campo `status` em `clients`
   - Lovable S7: migration com coluna status + CHECK + populacao (Issue #54)
   - Cursor PR #57: filtro `.in("status", ["ativo","trial"])` em 4 arquivos, toggle "Incluir inativos", badge STATUS_CONFIG (Issue #55)
   - Cursor PR #58: badge + banner informativo em ClientDetailPage (Issue #56)
10. **Concluido:** Checklist E2E v2 — 67 testes manuais cobrindo 8 rotas, 8 hooks, 5 RPCs, 2 perfis
11. **Concluido:** Sprint P1 — Edicao de cliente na tab Configuracoes (Issue #59, PR #61)
12. **Concluido:** Sprint P3 — CRUD de audit_rules na pagina Auditorias (Issue #60, PR #62)
13. **Concluido:** Sprint P4 — Busca server-side em 3 telas (Issue #63, PR #64)
14. **Pendente:** Lovable S6 — Edge function deliver-audit-alerts (baixa prioridade, depende de decisao sobre canal)
15. **Fechado:** PR #36 (docs: Auditoria UX/UI) — auditoria concluida
16. **Fechado:** Issue #13 — Banner reclassificacao (won't-fix, cenario ja passou)
17. **Fase 7:** Insights IA avancados
