# CONTEXT.md — Estado do Projeto (v25 — 2026-03-31)

> Mantido pelo Claude Code ao final de cada sessao. Lido por todos os agentes para manter contexto.
>
> last_updated: 2026-03-31
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
| 7 | Modulo de Tickets / Kanban | Concluido — Lovable S1-A/B/C + validacao S1-C + fixes B1/B2 (Issues #66-#67) |
| 7.1 | Onboarding User Access | Concluido — Migration (trigger + backfill) + Edge Function + ProtectedRoute bootstrap |
| 7.2 | Integracao Gist ↔ Ticket + Comentarios | Concluido — Sprint S2 (Issue #68): demand_interactions, demand_comments, LinkConversationDialog, tab Demandas na ClientDetailPage |
| 7.3 | Dashboard Analitico + One-Page + Bloqueio | Concluido — Sprint S3 (Issue #69): DemandsDashboardPage, PublicDemandsPage, client-demands-public, tokens, watchers, bloqueio/cancelamento, CSV export |
| 7.4 | Gestao de Usuarios e Permissionamento | Concluido — Sprint S4 (Issue #70): user_profiles, role global (admin/analyst/viewer), user_accessible_client_ids atualizada, aba Usuarios em Settings |
| 7.5 | Unificacao Assignees | Concluido — Issue #71: assignee_id → user_profiles, aba Responsaveis removida, dropdowns listam usuarios reais |
| 9 | Modulo de Pautas de Reuniao | Concluido — SA-1 (tabelas) + SA-2 (CRUD) + SA-3 (IA + homework→tickets) + SA-4 (settings) |
| 8 | Insights IA avancados | Placeholder |

---

## Fase 7 — Modulo de Tickets / Kanban (Lovable — Concluido)

### Sprint S1-A: Backend Schema (2026-03-17)

8 migrations criando o modelo de dados completo:

**Tabelas criadas:**
- `ticket_columns` — colunas do Kanban (name, position, color, triggers_started_at, triggers_finished_at)
- `demand_types` — tipos de demanda (name, color, icon, active, position)
- `demands` — demandas/tickets (title, description, expected_result, client_id, demand_type_id, priority ENUM, column_id, position, assignee TEXT, notes, is_blocked, blocker_reason, started_at, finished_at, area_id, assignee_id, rfi_url, created_by)
- `demand_activities` — log de auditoria (demand_id, event_type ENUM, description, from_value, to_value)
- `demand_areas` — areas responsaveis (name, color, active, position)
- `demand_assignees` — responsaveis (name, email, role, active)
- `demand_attachments` — anexos (demand_id, type file|link, url, filename, size_bytes, mime_type)
- `demand_notifications` — notificacoes realtime (user_id, demand_id, type ENUM, message, read)

**ENUMs:** `demand_priority` (low/medium/high/urgent), `demand_event_type` (created/moved/assigned/blocked/unblocked/edited/cancelled/linked_interaction)

**Storage:** Bucket `demand-attachments` (private, RLS para upload/download)

**RLS:** Todas as tabelas com RLS. `demands` filtrada por `user_accessible_client_ids()`. Settings tables (columns, types, areas, assignees) SELECT para todos, CRUD apenas admin.

**Indexes:** idx_demands_client, idx_demands_column, idx_demands_priority, idx_demand_activities_demand, idx_demand_attachments_demand, idx_demand_notifications_user

**Trigger:** `update_demand_last_updated()` — atualiza `last_updated` automaticamente

### Sprint S1-B: Kanban Frontend (2026-03-17)

**Pagina:** `DemandsPage.tsx` — Kanban board com drag-and-drop (@dnd-kit/core + @dnd-kit/sortable)
- Rota `/demands`, sidebar "Demandas" com icone Kanban
- DndContext com PointerSensor (8px activation distance)
- Drop em colunas OU em cards dentro de colunas
- Auto-trigger `started_at` / `finished_at` baseado em configuracao da coluna

**Componentes:** DemandCard, KanbanColumn, CreateDemandDialog, DemandDetailSheet (inline editing + attachments + timeline)

**Settings (admin-only, 3 tabs):** ColumnSettingsTab (DnD reorder, trigger badges), AreaSettingsTab (CRUD + color picker), AssigneeSettingsTab (CRUD + soft delete)

**Filtros:** 5 combobox filters (Search 3+ chars, Client, Type, Priority, Area)

### Sprint S1-C: Areas, Assignees, Attachments, Notifications (2026-03-18)

**Hooks criados:**
- `useDemands.ts` — queries + mutations (useTicketColumns, useDemandTypes, useDemands, useDemandActivities, useCreateDemand, useMoveDemand, useUpdateDemand, useDeleteDemand)
- `useDemandAreas.ts` — CRUD areas (add, update, deactivate, reactivate, delete)
- `useDemandAssignees.ts` — CRUD assignees
- `useDemandAttachments.ts` — file upload (Supabase Storage), add link, delete
- `useDemandNotifications.ts` — Realtime subscription (supabase.channel), mark read
- `useManageColumns.ts` — CRUD colunas + reorder

**staleTime:** Dados estaticos = 300s (5min). Dados dinamicos = 30s.

**Dependencias adicionadas:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Validacao S1-C + Fixes B1/B2 (2026-03-19)

Validacao feita pelo Vitor (triagem). 2 bugs identificados e corrigidos:

**B1 — Edicao inline nao atualizava em tempo real (Issue #66 — Fechada)**
- Causa raiz: DemandsPage armazenava objeto stale via useState + DemandDetailSheet nao re-sincronizava state local
- Fix: `selectedDemandId` + `useMemo` no parent, `useEffect` de sync no Sheet

**B2 — Campo RFI nao era link clicavel (Issue #67 — Fechada)**
- Causa raiz: RFI renderizado sempre como `<Input>`, sem modo visualizacao
- Fix: Icone ExternalLink clicavel + normalizacao automatica de URL (auto-prefix `https://`)

---

## Fase 7.1 — Onboarding User Access (Lovable — Concluido)

**Problema:** Novo usuario fazia signup mas `user_client_access` ficava vazio → RLS filtrava tudo → app vazio.

**Solucao (3 partes):**

### Migration: Trigger `on_client_created` + Backfill
- **Trigger:** `grant_new_client_to_all_users()` — SECURITY DEFINER, dispara AFTER INSERT em `clients`
- Quando sync cria novo client, todos os users ganham acesso viewer automaticamente
- **Backfill:** INSERT com CROSS JOIN + NOT EXISTS + ON CONFLICT DO NOTHING para users existentes sem acesso
- Nao altera registros existentes (admins preservados)

### Edge Function: `bootstrap-user-access`
- Chamada no primeiro login autenticado via `ProtectedRoute`
- Extrai user do JWT, verifica se tem 0 registros em `user_client_access`
- Se 0: insere viewer para todos os clients ativos via service_role
- Se >0: retorna `{ bootstrapped: false, reason: 'already_has_access' }`
- Idempotente, zero hardcode

### Frontend: `ProtectedRoute.tsx`
- `useEffect` chama `bootstrap-user-access` uma vez por sessao (flag `sessionStorage`)
- Flag so setada APOS sucesso da Edge Function (retry em caso de falha)
- `queryClient.invalidateQueries()` quando `bootstrapped: true` → dados aparecem sem F5
- Fire-and-forget: nao bloqueia renderizacao

## Fase 7.2 — Integracao Gist ↔ Ticket + Comentarios (Sprint S2 — Issue #68 — Concluido)

### Migration
- `ALTER TYPE demand_event_type ADD VALUE 'commented'`
- Tabela `demand_interactions` — vinculo conversa ↔ ticket (UNIQUE demand_id+interaction_id, RLS via demands→client_id)
- Tabela `demand_comments` — comentarios em tickets (RLS: read via demand, update/delete por created_by)
- DB function `get_client_conversations(p_client_id)` — conversas agrupadas por conversation_id, SECURITY DEFINER
- Realtime para ambas as tabelas novas

### Hooks criados
- `useDemandInteractions.ts` — useDemandInteractions, useClientConversations, useConversationMessages, useLinkInteractions, useUnlinkInteraction
- `useDemandComments.ts` — useDemandComments (com Realtime subscription), useCreateComment, useUpdateComment, useDeleteComment
- `useClientDemands.ts` — demands por client_id para tab na ClientDetailPage

### Frontend
- `LinkConversationDialog.tsx` — Dialog 2 passos (selecionar conversa → selecionar mensagens com checkboxes + "Selecionar todas")
- `DemandDetailSheet.tsx` — secoes "Conversas Vinculadas" (agrupadas por conversation_id, desvincular por mensagem) + "Comentarios" (Realtime, edicao inline, badge "editado", AlertDialog excluir)
- `ClientDetailPage.tsx` — nova tab "Demandas" com 4 KPIs (Total/Abertos/Concluidos/Bloqueados) + lista 20 tickets + botao "Nova demanda" pre-preenchido
- EVENT_ICONS: `linked_interaction → Link2`, `commented → MessageSquare`
- Fix preventivo: `selectedDemandId` + `useMemo` na ClientDetailPage (mesmo pattern B1)

---

## Fase 7.3 — Dashboard Analitico + One-Page + Bloqueio (Sprint S3 — Issue #69 — Concluido)

### Migration
- Tabela `demand_client_tokens` — token unico por cliente para One-Page publica (UNIQUE client_id, RLS via user_accessible_client_ids)
- Tabela `demand_watchers` — observadores por ticket (UNIQUE demand_id+user_id, insert/delete por auth.uid())
- DB function `get_demand_analytics(p_client_id, p_days)` — KPIs (total, open, completed, blocked, avg lead/cycle time), distribuicao por tipo/prioridade/coluna/area, tendencia semanal. SECURITY DEFINER + COALESCE para arrays
- DB function `get_client_public_demands(p_token)` — dados publicos por token, NAO expoe notes/description/rfi_url/blocker_reason/created_by

### Edge Function: `client-demands-public`
- GET sem autenticacao (service_role para chamar DB function)
- Token invalido → 404
- CORS habilitado

### Hooks criados
- `useDemandAnalytics.ts` — RPC get_demand_analytics, staleTime 120s
- `useDemandWatchers.ts` — query + useToggleWatcher mutation
- `useClientToken.ts` — query + useGenerateClientToken mutation (UPSERT)
- `usePublicDemands.ts` — chama Edge Function client-demands-public
- `useExportDemandsCSV.ts` — gera CSV e faz download

### Frontend
- `DemandsDashboardPage.tsx` — rota `/demands/dashboard`, 6 KPIs + 5 graficos recharts, filtros cliente/periodo
- `PublicDemandsPage.tsx` — rota `/public/demands/:token` FORA do ProtectedRoute, layout proprio sem sidebar, 4 KPIs + tabela de tickets, pagina de erro para token invalido
- `DemandDetailSheet.tsx` — secoes Bloqueio (marcar/desbloquear com motivo + activity log) + Cancelamento (5 motivos + coluna Cancelado) + Watchers (toggle observar)
- `ClientDetailPage.tsx` — secao "One-Page do Cliente" na aba Configuracoes (gerar/copiar/regenerar token, admin only)
- `DemandsPage.tsx` — botao "Exportar CSV"
- Sidebar: "Analytics de Demandas" adicionado

---

## Fase 7.4 — Gestao de Usuarios e Permissionamento (Sprint S4 — Issue #70 — Concluido)

### Migration
- Tabela `user_profiles` (id UUID PK sem FK em auth.users, email, full_name, global_role CHECK admin/analyst/viewer, active)
- RLS: `user_profiles_select_own` (id = auth.uid()), `user_profiles_select_admin` (scalar subquery sem recursao), `user_profiles_update` (admin only com WITH CHECK)
- Backfill via `INSERT ... SELECT FROM auth.users ON CONFLICT DO NOTHING`
- `user_accessible_client_ids` atualizada: admin global ve todos os clients ativos, outros via user_client_access
- `get_users_with_permissions()` — agrega user_profiles + user_client_access + auth.users, admin-only (RAISE EXCEPTION)

### Edge Function: bootstrap-user-access (estendida)
- Cria `user_profiles` ANTES do check de `user_client_access` (ponto critico — users existentes ja com acesso tambem ganham perfil)
- Usa `supaAdmin.auth.admin.getUserById()` para email/nome

### Hooks
- `useUserRole.ts` — expandido: le de `user_profiles.global_role` com fallback para `user_client_access`. `UserRole = "admin" | "analyst" | "viewer"`. Retorna `isAnalyst`.
- `useUsers.ts` — RPC get_users_with_permissions
- `useUserManagement.ts` — useUpdateUserRole (protecao auto-rebaixamento + ultimo admin), useUpdateClientAccess (UPSERT), useRemoveClientAccess, useToggleUserActive (protecao auto-desativacao)

### Frontend
- `UserManagementTab.tsx` — tabela com Select role inline, Switch ativo/inativo, busca, botao "Gerenciar"
- `UserPermissionsSheet.tsx` — overrides por cliente (Herdar global / viewer / analyst / Sem acesso), auto-save no onChange, callout especial para admin global
- `SettingsPage.tsx` — aba "Equipe & Acessos" (admin-only)

### Acao manual pos-deploy
```sql
UPDATE user_profiles SET global_role = 'admin' WHERE email = '<email_do_operador>';
```

---

## Fase 7.5 — Unificacao Assignees (Issue #71 — Concluido)

**Problema:** `demand_assignees` (nomes livres) e `user_profiles` (usuarios reais) eram redundantes.

### Migration
- RLS `user_profiles_select_active` — qualquer autenticado le perfis ativos (necessario para dropdown de responsavel)
- Nullify `assignee_id` orfaos (que apontavam para demand_assignees)
- Tabela `demand_assignees` mantida no banco (nao dropada)

### Mudancas
- `useDemands.ts` e `useClientDemands.ts` — join troca de `demand_assignees(name)` para `user_profiles!assignee_id(full_name, email)`
- `DemandCard.tsx` — exibe `full_name ?? email`
- `CreateDemandDialog.tsx` e `DemandDetailSheet.tsx` — dropdown lista `user_profiles` ativos (query `user_profiles_active`)
- `SettingsPage.tsx` — aba "Responsaveis de Tarefas" removida
- **Fix adicional:** aba "Areas" havia sido removida acidentalmente junto com "Responsaveis" — restaurada

---

## Fase 9 — Modulo de Pautas de Reuniao (SA-1 a SA-4 — Concluido)

### SA-1: Backend Schema (2026-03-26)

Migration com 3 tabelas + RLS + indexes + trigger + seed:

**Tabelas criadas:**
- `meeting_agendas` — pauta principal (client_id, title, meeting_date, objective, context_notes, satisfaction_score 1-5, next_steps, location, transcription TEXT, executive_summary TEXT, ai_processed BOOLEAN, ai_processed_at TIMESTAMPTZ)
- `meeting_participants` — participantes (agenda_id, participant_id FK, user_profile_id FK, role, name)
- `meeting_homework_items` — licoes de casa (agenda_id, description, responsible_side client/umode, responsible_label, due_date, status pending/done/cancelled, converted_to_demand_id FK demands)

**RLS:** Todas via `user_accessible_client_ids()` no client_id da agenda
**Indexes:** idx_meeting_agendas_client, idx_meeting_agendas_date (DESC), idx_meeting_homework_agenda, idx_meeting_participants_agenda
**Trigger:** `update_meeting_agenda_updated_at` — atualiza updated_at automaticamente
**Seed:** `app_settings.agenda_required_fields` com ON CONFLICT DO NOTHING
**Realtime:** Habilitado para as 3 tabelas

### SA-2: CRUD Frontend (2026-03-26)

**Pagina:** `AgendasPage.tsx` — rota `/agendas`, sidebar "Pautas" com icone Calendar
**Componentes:** CreateAgendaDialog, AgendaDetailSheet (inline editing + satisfaction + homework + transcription), SatisfactionPicker (5 emojis), ClientAgendasTab (aba "Pautas" na ClientDetailPage)
**Hooks:** useMeetingAgendas (CRUD), useMeetingParticipants (add/remove), useMeetingHomework (CRUD), useAgendaFieldConfig (visibilidade de campos)
**staleTime:** 5min em todas as queries

### SA-3: IA + Homework → Tickets (2026-03-26)

**Edge Function:** `process-meeting-transcription` — recebe agenda_id + transcription, chama Gemini 2.0 Flash, extrai resumo executivo + licoes de casa uMode + licoes de casa cliente. Salva no banco e marca ai_processed = true.
**Hook:** useMeetingAI — useProcessTranscription (mutation) + useConvertHomeworkToTicket (vincula homework → demand)
**Frontend:** Secao transcricao com textarea + botao "Processar com IA" (isPending guard), resumo executivo editavel (save onBlur), lista de licoes de casa separadas por lado (uMode/Cliente), botao "→ Ticket" abre CreateDemandDialog pre-preenchido, "Ver ticket" para itens ja convertidos.
**DELETE seguro:** Reprocessamento deleta apenas itens com `converted_to_demand_id IS NULL` — protege itens ja convertidos.

### SA-4: Settings (2026-03-26)

**Componente:** AgendaSettingsTab — aba "Pautas" em Settings (admin-only)
**Funcionalidade:** RadioGroup para cada campo (Obrigatorio/Opcional/Oculto), salva em `app_settings.agenda_required_fields` via useMutation
**Guard:** isDirty check + isPending disable no botao Salvar

### Auditoria (Claude Code — 2026-03-26)

Relatorio: `auditorias/AUDITORIA_20260326_SA1_SA4.md`

**Criticos (2):** ~~Edge Function sem JWT + CORS wildcard~~ → RESOLVIDOS (Lovable, auditado 2026-03-26)
**Medios (5):** DELETE sem error handling, rawText em log, 3x as unknown as, 2x imports nao usados
**Baixos (4):** Cores hardcoded, stagger animation, as never cast
**PASS:** m2, m3, m4, m5, m7, m8 (hooks), m9, m10, m11 (exceto 2), RLS, indexes, trigger, seed, Gemini, DELETE protege convertidos

---

## Fase 5 — Priority Score Engine

### Backend (Issue #32 — Lovable — Concluido)

- **Migration:** ENUM `client_tier` + tabelas `client_priority_config` e `priority_scores` com RLS
- **Edge Function:** `calculate-priority-scores` — modular (6 funcoes puras em `logic.ts`), env-driven (`PRIORITY_*`), auth JWT+admin, batch+auto-chain
- **Event-driven:** `process-jobs` dispara calculo apos `classify_batch` completar (fire-and-forget)
- **pg_cron:** schedule a cada 2h como safety net
- **Seed:** 13 clientes configurados (By NV=azzas, Osklen=enterprise, restante=medium)
- **Testes:** 9 casos unitarios para `calculateScore` (4) e `detectPatterns` (5) em `index.test.ts`
- **types.ts:** regenerado com `client_priority_config`, `priority_scores`, `client_tier`

### Frontend (Issue #33 — Cursor — Concluido)

- **PR #34 (UX fixes):** 17 "Em breve" removidos, getHealthColor corrigido, "Hub Central" -> "CX Hub"
- **PR #35 (Dashboard):** Priority Dashboard com ranking, tier badges, patterns expandiveis, score cap visual 100, admin features, dark mode, mobile responsive
- **Hooks criados:** useUserRole, usePriorityScores, useRecalculatePriority
- **Design System:** `docs/DESIGN_SYSTEM.md` criado como fonte unica de verdade
- **Keyframes custom:** 5 registrados no `tailwind.config.ts`

### Auditoria UX/UI — 12 PRs do Cursor (todos mergeados, historico)

| PR | Titulo | LOTE |
|----|--------|------|
| #39-#43 | Error states, auth useMutation, Audits empty state, NotFound Link, Settings priorities | 1 |
| #44 | Dark mode tone/status colors, shimmer, layout padding | 2 |
| #45 | Accessibility aria-labels, focus-visible | 3 |
| #46-#48 | Score column, Dashboard search+filter, ClientDetail score card | 4 |
| #49-#50 | Recharts volume chart, Dashboard global KPIs | 5 |
| #51-#53 | Audits UI real, SearchPage, tone trend 7d chart | 6-FE |

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
- **Custo total backlog:** ~$2.22

---

## Issues

| # | Issue | Status | Responsavel |
|---|-------|--------|-------------|
| #2-#10 | Bugs iniciais (proxy, safety filter, realtime, timeouts, attachments) | Resolvidos | Lovable |
| #11 | Migration: conversation_id column + backfill + index | Resolvido | Lovable |
| #12 | classify_batch por conversa (nao por mensagem isolada) | Resolvido | Lovable |
| #13 | Banner de reclassificacao (opcional) | Fechado (won't-fix) | Lovable |
| #14 | Calibracao de tom + filtro 365d | Resolvido | Lovable |
| #15 | Prompt Mega Agente v3 | Resolvido | Lovable |
| #16 | Gemini Pro definitivo + prompt v6 com few-shot examples | Resolvido | Lovable |
| #17-#22 | Divida tecnica CTO (m1,m3,m4,m5,m6,m9,m12) | Resolvidos (PRs #23-#28) | Cursor |
| #29-#30 | m9 handleToggleRule + UX NotFound | Resolvido (PR #31) | Cursor |
| #32 | Fase 5: Priority Score Engine backend | Concluido (Fechada 2026-03-24) | Lovable |
| #33 | Fase 5: Priority Dashboard + UX cleanup | Concluido (PR #34 + PR #35) | Cursor |
| #37 | DB function global_stats_30d | Concluido (Fechada 2026-03-24) | Lovable |
| #38 | Edge function evaluate-audit-rules | Concluido (Fechada 2026-03-24) | Lovable |
| #39-#53 | Auditoria UX/UI — 15 PRs do Cursor | Mergeados | Cursor |
| #54 | feat(db): coluna status em clients | Concluido | Lovable |
| #55-#56 | feat(ui): filtro e badge de status | Mergeados (PRs #57-#58) | Cursor |
| #59 | feat(ui): edicao de cliente | Mergeado (PR #61) | Cursor |
| #60 | feat(ui): CRUD audit_rules | Mergeado (PR #62) | Cursor |
| #63 | fix: busca server-side em 3 telas | Mergeado (PR #64) | Cursor |
| #65 | fix: SearchPage TDZ | Corrigido (Fechada 2026-03-24) | Lovable |
| #66 | fix: edicao inline DemandDetailSheet | Fechada | Lovable |
| #67 | fix: campo RFI nao clicavel | Fechada | Lovable |
| #68 | Sprint S2: Gist ↔ Ticket + Comentarios | Fechada | Lovable |
| #69 | Sprint S3: Dashboard + One-Page + Bloqueio | Fechada | Lovable |
| #70 | Sprint S4: Gestao de Usuarios + Permissionamento | Fechada | Lovable |
| #71 | Unificar assignees demand_assignees → user_profiles | Fechada | Lovable |

---

## Auditoria Completa (Claude Code — 2026-03-24)

Relatorio: `auditorias/AUDITORIA_20260322_1500.md`
Pendencias: `auditorias/PENDENTES.md`

**Resultado:** 9/13 itens CTO limpos. ~~4 criticos~~, 9 medios, 3 baixos.

### Criticos — RESOLVIDOS (2026-03-24, Lovable, auditado pelo Claude Code)
- **SEC1/SEC2:** ~~sem JWT + CORS aberto~~ → JWT via `auth.getUser()` + CORS via `ALLOWED_ORIGIN` env var + safeParams em gist-proxy ✅
- **AP1:** ~~DELETE sem filtro~~ → `.eq('metadata->>auto_created', 'true')` adicionado ✅

### Altos — RESOLVIDOS (2026-03-24, Lovable, auditado pelo Claude Code)
- **AP2:** ~~INSERT sem ON CONFLICT~~ → error.code 23505 tratado graciosamente ✅
- **AP3:** ~~INSERTs sem conflict~~ → upsert com onConflict em clients, user_client_access, channel_bindings ✅
- **M12:** ~~query sem paginacao~~ → .limit(500) + order desc + reverse + banner de aviso ✅

### Medios
- **M1:** 7x `as unknown as Type` em hooks (bypass tipagem)
- **M9:** `GistContactWizard.tsx:304` useState manual em vez de useMutation
- **DS1-DS3:** Cores HSL hardcoded + green-500 em vez de emerald-500
- **O2:** TONE_CONFIG duplicado em 3 paginas

### Baixos
- **M13:** Sem testes para process-jobs, classify-batch, ClientContext
- **DS4/DS5:** Skeleton animate-pulse + falta motion-safe prefix

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

Todos resolvidos. Ver PRs #31, #34, #35, #41, #43-#50, #51 para detalhes.

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
- **Batch:** 10 conversas/batch (~200 msgs), propagacao para todas as mensagens
- **Prompt Mega Agente:** contexto uMode (B2B textil/moda), rubrica de tom 4 niveis, 8 regras anti-vies, 14 temas, 4 few-shot examples
- **Auto-chain limit:** `MAX_BATCHES_PER_JOB = 50`

### Priority Score Engine (Fase 5)
- **Edge Function:** `calculate-priority-scores` — modular, 6 funcoes, logica pura em `logic.ts`
- **Score:** `Σ(user_count × severityWeight[worst_tone] × recencyWeight) × weight_multiplier`
- **Triggers:** manual (POST com JWT admin), pg_cron (2h), event-driven (apos classify_batch)
- **Chain:** apos completar (!hasMore), dispara `evaluate-audit-rules` (fire-and-forget)

### Auditorias e Alertas (Fase 6 — backend completo)

#### RLS Policies (Lovable S1)
- **audit_rules:** SELECT para todos com acesso, INSERT/UPDATE/DELETE apenas admin
- **audit_alerts:** SELECT only (INSERT via service_role na Edge Function)
- `user_accessible_client_ids()` retorna `SETOF uuid` — nao requer `unnest()`

#### Seed + Realtime + pg_cron (Lovable S2)
- **Seed:** 39 regras (3 metricas x 13 clientes ativos)
- **Realtime:** `audit_alerts` no `supabase_realtime` publication
- **pg_cron:** `evaluate-audit-rules` a cada 2h (minuto :15)

#### DB Functions (Lovable S3-S5 + Issue #37)
- `audit_alerts_summary` — total_alerts_30d, unread_count, alerts top 50
- `search_interactions` — full-text search com ts_rank, filtros, paginacao
- `client_tone_trend_7d` — 7 rows por dia, index-friendly
- `global_stats_30d` — KPIs 30d, evolucao tom 6 meses, top themes

#### Edge Function: `evaluate-audit-rules` (Issue #38)
- **Metricas:** score_prioridade, tom_critico_pct, tom_alerta_pct, volume_periodo
- **Fluxo:** fetchActiveRules → calculateMetric → evaluateRule → checkCooldown → insertAlert
- **Trigger:** encadeado apos calculate-priority-scores (!hasMore)

### Campo `status` em `clients` (Fase 6.5)
- **Coluna:** `status TEXT NOT NULL DEFAULT 'ativo'` com CHECK `('ativo','inativo','trial')`
- **Controle:** 100% manual (Operador). Independente de `active`.
- **Frontend:** filtro default ativo/trial + toggle "Incluir inativos"

### Modulo de Tickets / Kanban (Fase 7 + 7.2 + 7.3 + 7.4 + 7.5)

Documentacao completa nas secoes "Fase 7" a "Fase 7.5" acima. Resumo:
- **13 tabelas** com RLS (demands, activities, areas, assignees[legado], attachments, notifications, interactions, comments, client_tokens, watchers, user_profiles + ticket_columns, demand_types)
- **4 DB functions** (get_client_conversations, get_demand_analytics, get_client_public_demands, get_users_with_permissions)
- **2 Edge Functions** (client-demands-public, bootstrap-user-access estendida)
- **3 paginas** (DemandsPage/Kanban, DemandsDashboardPage, PublicDemandsPage)
- **~8 componentes** demands/ + **~20 hooks** + DnD + Realtime
- **Rotas:** `/demands`, `/demands/dashboard`, `/public/demands/:token`
- **Permissionamento:** role global em user_profiles (admin/analyst/viewer), user_accessible_client_ids com bypass admin
- **Assignees unificados:** demand_assignees desacoplada, assignee_id → user_profiles

### Onboarding User Access (Fase 7.1)

Documentacao completa na secao "Fase 7.1" acima. Resumo:
- **Trigger** `on_client_created` — novo client → viewer para todos os users
- **Edge Function** `bootstrap-user-access` — primeiro login → viewer em todos os clients
- **ProtectedRoute** — chama bootstrap fire-and-forget + invalidateQueries

### Sprint P1: Edicao de cliente (Issue #59, PR #61)
- **Tab Configuracoes** em ClientDetailPage: formulario com nome, status, scope, tier
- **saveClientMutation:** atualiza clients + upsert client_priority_config

### Sprint P3: CRUD de audit_rules (Issue #60, PR #62)
- **Tabs** em Audits.tsx: "Alertas" + "Regras" (CRUD com 10 campos, admin-only)

### Sprint P4: Busca server-side (Issue #63, PR #64)
- **Hook:** `useDebounce<T>` — compartilhado entre 3 telas
- **Regra:** minimo 3 chars, debounce 300ms

### Modulo de Pautas de Reuniao (Fase 9)

Documentacao completa na secao "Fase 9" acima. Resumo:
- **3 tabelas** com RLS (meeting_agendas, meeting_participants, meeting_homework_items)
- **1 Edge Function** (process-meeting-transcription — Gemini 2.0 Flash)
- **1 pagina** (AgendasPage) + **4 componentes** agendas/ + **5 hooks** + tab na ClientDetailPage
- **Settings:** AgendaSettingsTab (visibilidade de campos)
- **Rotas:** `/agendas`
- **Homework → Ticket:** CreateDemandDialog pre-preenchido, converted_to_demand_id vincula

### Design System (docs/DESIGN_SYSTEM.md)
- **Paleta semantica:** tom, tier, score, severity, saude
- **Motion patterns:** 5 keyframes custom no tailwind.config.ts

### Auditoria de Qualidade (blind tests com 32 conversas)

| Versao | Modelo | Prompt | Nota | Tom | Tema |
|--------|--------|--------|------|-----|------|
| **v6** | **Pro** | **Mega Agente + few-shot** | **9.0** | **84%** | **84%** |

### Volume e Custos
- **Backlog:** ~33k msgs em ~1.680 conversas (100% classificado)
- **Volume mensal:** ~117 conversas/mes
- **Custo Gemini Pro:** ~$2.22 backlog + ~$0.16/mes (~$2/ano)

---

## Colaboracao

Papeis, restricoes, fluxos e checklist completos em AGENTS.md (v9).

| Agente | Papel | Canal |
|--------|-------|-------|
| **Claude Code** | Revisao, Engenharia e Coordenacao | Terminal / CLI |
| **Lovable** | Frontend + Backend (escopo total desde 2026-03-17) | Interface Lovable |
| **Cowork** | Guardiao de Documentacao | Claude Desktop (pasta do repo) |
| **Projeto** | Auditoria e Estrategia | claude.ai |
| **Operador** (Joao) | Orquestrador Humano | Supabase Dashboard / GitHub |

### Mudanca de estrategia (2026-03-17)
- **Cursor DESCONTINUADO** — removido do projeto. PRs historicos preservados.
- **Lovable assume escopo total** (frontend + backend + deploy)
- **Claude Code** audita todo codigo do Lovable contra Checklist do CTO + Design System + Anti-padroes
- **Claude Code NUNCA edita codigo fonte** — apenas gera prompts para Lovable
- **Lovable sync bidirecional:** commits vao direto para `main` (sem PRs separados)

### Preferencias do Operador
- Respostas diretas e concisas — sem enrolacao
- Conteudo self-contained para copy-paste — nunca pedir para intermediar
- Nao dar estimativas de tempo — focar no que precisa ser feito
- Todos os outputs dentro do repo conforme estrutura de pastas
- Prompts para Lovable: salvar em `docs/prompts/` e enviar link publico do GitHub
- Repo publico: github.com/HyTrackWater/gist-insights-hub

---

## Estrutura de Pastas

```
gist-insights-hub/
├── CONTEXT.md, AGENTS.md, CLAUDE.md, README.md   # Raiz — docs de governo
├── docs/
│   ├── PRD.md                                     # PRD completo (documento vivo)
│   ├── DESIGN_SYSTEM.md                           # Design System
│   ├── E2E_TEST_PLAN.md                           # Testes E2E
│   ├── COWORK_GUARDIAN_INSTRUCTION_v2.md           # Instrucao do Cowork
│   ├── mega-agente/                               # Prompt do Mega Agente
│   ├── prompts/                                   # Prompts ativos Lovable
│   │   └── archive/                               # Prompts de fases anteriores
│   ├── auditorias/                                # Auditorias MANUAIS
│   └── plans/                                     # Planos executivos historicos
├── auditorias/                                    # Relatorios AUTOMATICOS do Cowork
│   └── PENDENTES.md                               # Violacoes abertas
├── scripts/
├── src/                                           # Frontend + UI (Lovable)
│   ├── components/demands/                        # Modulo de Tickets (8 componentes)
│   └── pages/
│       ├── DemandsDashboardPage.tsx                # Dashboard analitico de tickets
│       └── PublicDemandsPage.tsx                   # One-Page publica (sem auth)
└── supabase/                                      # Backend (Lovable) — migrations, edge functions
    └── functions/
        ├── bootstrap-user-access/                 # Onboarding automatico
        └── client-demands-public/                 # One-Page publica (sem auth)
```

---

## Proximos Passos

1. **Concluido:** Reclassificacao do backlog (100% da janela 365d, 6 jobs, ~$2.22)
2. **Concluido:** Divida tecnica do Checklist CTO (m1, m3, m4, m5, m6, m9, m12) — 8 PRs mergeados
3. **Concluido:** Fase 5 — Priority Score Engine (backend + frontend)
4. **Concluido:** Fase 6 — Auditorias e Alertas (backend S1-S5 + frontend PRs #51-#53)
5. **Concluido:** Auditoria UX/UI — 12 PRs do Cursor (#39-#53)
6. **Concluido:** Lovable Marathon — 5 sessoes de backend (S1-S5)
7. **Concluido:** Fase 6.5 — Campo status em clients (Issue #54, PRs #57-#58)
8. **Concluido:** Sprint P1+P3+P4 (Issues #59, #60, #63; PRs #61, #62, #64)
9. **Concluido:** Cursor descontinuado (2026-03-17) — Lovable assume escopo total
10. **Concluido:** Fase 7 — Modulo de Tickets / Kanban (Lovable S1-A/B/C)
    - S1-A: 8 migrations (tabelas, ENUMs, indexes, trigger, storage bucket, RLS)
    - S1-B: Kanban frontend (DemandsPage, DnD, filtros, settings tabs)
    - S1-C: Areas, Assignees, Attachments, Notifications (6 hooks, 7 componentes)
    - Validacao S1-C: 2 bugs corrigidos (Issues #66-#67)
11. **Concluido:** Issue #65 — SearchPage TDZ fix
12. **Concluido:** Fase 7.1 — Onboarding User Access
    - Migration: trigger on_client_created + backfill (viewer para todos)
    - Edge Function: bootstrap-user-access (primeiro login)
    - ProtectedRoute: fire-and-forget + invalidateQueries apos bootstrap
13. **Concluido:** Fase 7.2 — Sprint S2: Integracao Gist ↔ Ticket + Comentarios (Issue #68)
    - demand_interactions + demand_comments + get_client_conversations + Realtime
    - LinkConversationDialog (2 passos) + secoes no Sheet + tab Demandas na ClientDetailPage
14. **Concluido:** Fase 7.3 — Sprint S3: Dashboard Analitico + One-Page + Bloqueio (Issue #69)
    - demand_client_tokens + demand_watchers + get_demand_analytics + get_client_public_demands
    - Edge Function client-demands-public + DemandsDashboardPage + PublicDemandsPage
    - Bloqueio/Cancelamento/Watchers no Sheet + token na ClientDetailPage + Export CSV
15. **Concluido:** Fase 7.4 — Sprint S4: Gestao de Usuarios (Issue #70)
    - user_profiles + role global (admin/analyst/viewer) + user_accessible_client_ids atualizada
    - bootstrap-user-access estendida + useUserRole expandido + aba Equipe & Acessos
16. **Concluido:** Fase 7.5 — Unificacao Assignees (Issue #71)
    - assignee_id → user_profiles, aba Responsaveis removida, RLS permissiva para dropdown
    - Fix: aba Areas restaurada (removida acidentalmente)
17. **Concluido:** SEC1/SEC2 — JWT + CORS em gist-discover e gist-proxy (Lovable, auditado 2026-03-24)
18. **Concluido:** AP1 — filtro auto_created no DELETE de process-jobs (Lovable, auditado 2026-03-24)
19. **Concluido:** AP2/AP3 — ON CONFLICT em evaluate-audit-rules e gist-confirm-mapping (Lovable, auditado 2026-03-24)
20. **Concluido:** M12 — paginacao em InteractionsFeed.tsx com .limit(500) (Lovable, auditado 2026-03-24)
21. **Concluido:** Issues #32, #37, #38, #65 fechadas no GitHub (2026-03-24)
22. **Concluido:** Fase 9 — Modulo de Pautas de Reuniao (SA-1 a SA-4, Lovable, auditado 2026-03-26)
23. **Concluido:** Fix seguranca process-meeting-transcription (JWT + CORS + DELETE error + log sanitizado, Lovable, auditado 2026-03-26)
24. **Concluido:** DT-1 — Divida tecnica parcial (paleta, 7/10 casts, mutation, imports, skeleton, stagger, key, tipagem)
25. **Concluido:** Features #10-#18 (branding, toggle ativo, RLS fix, duration, filtros, badge, logout, blocked tickets, watchers names)
26. **Concluido:** DT-1b — 4/6 residuais corrigidos (cores, error handlers). 2 casts mantidos (TypeScript exige as unknown as)
27. **Concluido:** Intervencoes Victor/Operador (2026-03-31, auditado Claude Code):
    - Fix critico: RLS recursion em user_client_access → policies usam is_admin() em vez de auto-referencia
    - FK demand_watchers.user_id → user_profiles(id) com ON DELETE CASCADE
    - Optimistic updates em useToggleWatcher (onMutate/onError/onSettled)
    - Fix build: tipagem process-jobs classify batch + Gemini model update
28. **Pendente:** Lovable S6 — Edge function deliver-audit-alerts (baixa prioridade)
29. **Pendente:** Testar notificacoes in-app com 2 usuarios simultaneos
30. **Fase 8:** Insights IA avancados
