# PENDENTES — Violações em Aberto

> Atualizado por: Claude Code
> Última atualização: 2026-05-07

## Críticas (abertas)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| CTX1 | 2026-05-07 | CRÍTICO | supabase/migrations/20260507120240_*.sql | `get_cx_analytics_metrics` SECURITY DEFINER sem filtro `user_accessible_client_ids` — qualquer authenticated user vê analytics CX de todos clientes | ABERTO |
| CTX2 | 2026-05-07 | CRÍTICO | supabase/migrations/20260507114714_*.sql | `get_tech_dashboard_metrics` mesma falha — sem RLS por user (defensável só se documentado como decisão de produto) | ABERTO |
| CTX3 | 2026-05-07 | CRÍTICO | supabase/migrations/20260505215732_*.sql | `user_accessible_client_ids` reescrita sem trail — introduz `bypass_client_access` mudando contrato de função core de RLS | ABERTO |

## Críticas (resolvidas — histórico)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| SEC1 | 2026-03-22 | CRÍTICO | gist-discover/index.ts | ~~Sem validação JWT + CORS aberto~~ → JWT via auth.getUser() + CORS via ALLOWED_ORIGIN | RESOLVIDO 2026-03-24 |
| SEC2 | 2026-03-22 | CRÍTICO | gist-proxy/index.ts | ~~Sem JWT + CORS aberto + params sem sanitização~~ → JWT + CORS + safeParams | RESOLVIDO 2026-03-24 |
| AP1 | 2026-03-22 | CRÍTICO | process-jobs/index.ts:380 | ~~DELETE sem filtro auto_created~~ → .eq('metadata->>auto_created', 'true') | RESOLVIDO 2026-03-24 |
| CTX4 | 2026-04-20 | CRÍTICO | migrations/20260420211903_*.sql | DELETE histórico `<2026-01-01` sem filtro `auto_created` — viola PRD §6. Já executado/irreversível. | EXECUTADO (lição) |
| CTX5 | 2026-05-05 | CRÍTICO | migrations/20260505133227 → 134758 | Janela ~1h com `projects_insert WITH CHECK (true)` — qualquer user podia inserir project com qualquer owner_id | RESOLVIDO 2026-05-05 |

## Altas (abertas)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| CTX6 | 2026-05-07 | ALTO | migrations/20260504131751_*.sql | `deactivate_stale_clients` SECURITY DEFINER sem `is_admin()` guard — qualquer authenticated user pode invocar via RPC | ABERTO |
| CTX7 | 2026-05-07 | ALTO | migrations/20260507113359_*.sql | Mudança silenciosa de contrato de `projects.workspace` (de "determina visibilidade" para "apenas informativo") sem aviso aos consumers | ABERTO |
| CTX8 | 2026-05-07 | ALTO | migrations/20260507113359_*.sql | Backfill `is_internal=true WHERE client_id IS NULL` pode marcar projetos rascunho/transição como internos | ABERTO |

## Altas (resolvidas — histórico)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| AP2 | 2026-03-22 | ALTO | evaluate-audit-rules/index.ts | ~~INSERT sem ON CONFLICT~~ → error.code 23505 ignorado | RESOLVIDO 2026-03-24 |
| AP3 | 2026-03-22 | ALTO | gist-confirm-mapping/index.ts | ~~INSERTs sem conflict~~ → upsert com onConflict em 3 tabelas | RESOLVIDO 2026-03-24 |
| M12 | 2026-03-22 | ALTO | InteractionsFeed.tsx | ~~Query sem limit~~ → .limit(500) + order desc + reverse + banner | RESOLVIDO 2026-03-24 |

## Médias (abertas — burst 2026-05-07)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| CTX9 | 2026-05-07 | MÉDIO | 7 RLS policies novas | `client_id IN (SELECT user_accessible_client_ids(auth.uid()))` — pattern frágil. Padrão do projeto: `IN (SELECT * FROM user_accessible_client_ids(...))` | ABERTO |
| CTX10 | 2026-05-07 | MÉDIO | migrations/20260505215732_*.sql | `meeting_agendas.project_id` sem CHECK constraint — comment promete "apenas internal" mas não força | ABERTO |
| CTX11 | 2026-05-07 | MÉDIO | migrations/20260507115132_*.sql | `auto_unblock_dependent_demands` usa `LIKE 'Aguardando conclusão de:%'` — frágil a edição manual e i18n | ABERTO |
| CTX12 | 2026-05-07 | MÉDIO | src/hooks/useProjects.ts:270-301 | `useCreateProject` faz 2 queries (RPC + UPDATE is_internal) — race condition. RPC deveria aceitar `p_is_internal` | ABERTO |
| CTX13 | 2026-05-07 | MÉDIO | migrations/20260505132732_*.sql | `projects_update` permite mudar `owner_id` — transferência de posse silenciosa sem fluxo dedicado | ABERTO |
| CTX14 | 2026-05-07 | MÉDIO | hooks novos | 10× `as unknown as` em useProjects/useTechDashboard/useCxAnalytics — débito m1 replicado | ABERTO |
| CTX15 | 2026-05-07 | MÉDIO | migrations/20260505215732_*.sql | `demand_block_history` sem UPDATE policy explícita — intencional (só trigger) mas não documentado | ABERTO |
| CTX16 | 2026-05-07 | MÉDIO | migrations/20260505104942_*.sql | `cancel_project` exclui admin global — só owner pode cancelar | ABERTO |
| CTX17 | 2026-05-07 | MÉDIO | mark_sla_first_response, check_demand_auto_complete | `LIMIT 1` sem `ORDER BY` em busca de columns por trigger flag — não-determinístico se +1 coluna marcada | ABERTO |
| CTX18 | 2026-05-07 | MÉDIO | 5+ edge functions | `ALLOWED_ORIGIN ?? "*"` — fallback para wildcard CORS se env var faltar em prod | ABERTO |
| CTX19 | 2026-05-07 | MÉDIO | get_demand_total_hours, get_demand_task_stats, get_demand_block_metrics, get_demand_relationships | SECURITY DEFINER sem check de acesso à demand — vazamento de métricas agregadas | ABERTO |

## Médias (resolvidas — histórico)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| M1a | 2026-03-22 | MÉDIO | Múltiplos hooks | ~~10x as unknown as~~ → 7 corrigidos (DT-1). 2 residuais corrigíveis + 5 justificados (JOINs/JSON/error) | PARCIAL |
| M9a | 2026-03-22 | MÉDIO | GistContactWizard.tsx | ~~useState manual~~ → useMutation + isPending (DT-1) | RESOLVIDO 2026-03-30 |
| DS1 | 2026-03-22 | MÉDIO | DemandsDashboardPage.tsx | ~~HSL hardcoded~~ → importa PRIORITY_CHART_COLORS de colorPalette.ts | RESOLVIDO 2026-03-30 |
| DS2 | 2026-03-22 | MÉDIO | ClientDetailPage.tsx:713 | ~~HSL hardcoded~~ → chart config corrigido. **RESIDUAL:** bg-green-500 em tone distribution bar | PARCIAL |
| O2 | 2026-03-08 | MÉDIO | SearchPage/ClientDetailPage/Index | ~~TONE_CONFIG duplicado~~ → centralizado em colorPalette.ts | RESOLVIDO 2026-03-30 |
| F16 | 2026-03-30 | MÉDIO | AppSidebar.tsx | ~~logoutMutation sem onError~~ → toast.error adicionado | RESOLVIDO 2026-03-30 |
| F17 | 2026-03-30 | MÉDIO | DemandsDashboardPage.tsx | ~~blocked_demands sem toast~~ → useEffect + toast.error | RESOLVIDO 2026-03-30 |
| DS-R1 | 2026-03-30 | BAIXO | Index.tsx | ~~HSL hardcoded~~ → TONE_CHART_COLORS importado | RESOLVIDO 2026-03-30 |

## Baixas (abertas — burst 2026-05-07)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| CTX20 | 2026-05-07 | BAIXO | blocker_types RLS, squads RLS (extinto) | RLS usa `EXISTS user_profiles WHERE global_role='admin'` em vez do helper `is_admin()` — inconsistência | ABERTO |
| CTX21 | 2026-05-07 | BAIXO | deactivate_stale_clients vs cleanup manual 2026-05-04 | Migração usa `active=false`. Cleanup manual usou `status='inativo' + flag cleanup`. Documentar pattern oficial | ABERTO |
| CTX22 | 2026-05-07 | BAIXO | classification_prompt_config | `created_by` aponta `auth.users(id)`. Resto usa `user_profiles(id)` | ABERTO |
| CTX23 | 2026-05-07 | BAIXO | migrations/20260505114746_*.sql | Heurística `LOWER(name) LIKE '%opera%'` para classificar áreas como CX | ABERTO |
| CTX24 | 2026-05-07 | BAIXO | get_tech_dashboard_metrics | 305 linhas em uma função — viola "Funções concisas" do Playbook | ABERTO |
| CTX25 | 2026-05-07 | BAIXO | demand_event_type | Falta valor `'reopened'`. `reopen_count` hardcoded como 0 | ABERTO |
| CTX26 | 2026-05-07 | BAIXO | get_tech_dashboard_metrics | Regex `~* '^[0-9a-f-]{36}$'` para UUID — frouxo (aceita 36 hyphens). Cast `::UUID` é mais rigoroso | ABERTO |
| CTX27 | 2026-05-07 | BAIXO | classification_prompt_config | `valid_themes jsonb` sem CHECK de schema | ABERTO |
| CTX29 | 2026-05-07 | BAIXO | migrations/20260505104539_*.sql | UPDATE redundante após ALTER com NOT NULL DEFAULT — dead code | ABERTO |
| CTX30 | 2026-05-07 | BAIXO | demand_tasks triggers | Triggers sem SECURITY DEFINER — inconsistente com resto | ABERTO |
| CTX31 | 2026-05-07 | BAIXO | src/pages/ProjectsPage.tsx:72 | Imports no meio do arquivo (após função) | ABERTO |
| CTX32 | 2026-05-07 | BAIXO | ProjectsPage filter | N×useProjectStats em paralelo — escala mal além de ~50 projetos | ABERTO |
| CTX37 | 2026-05-07 | BAIXO | get_demand_relationships, get_demand_block_metrics | Retornam JSON sem schema TS validado em runtime | ABERTO |

## Baixas (resolvidas — histórico)

| ID | Data | Severidade | Arquivo | Descrição | Status |
|----|------|-----------|---------|-----------|--------|
| M13a | 2026-03-22 | BAIXO | — | Sem testes para process-jobs, classify-batch, ClientContext, interactions | ABERTO |
| DS5 | 2026-03-22 | BAIXO | Múltiplos | Zero uso de motion-safe: prefix | ABERTO |
| DS4 | 2026-03-22 | BAIXO | skeleton.tsx | ~~animate-pulse~~ → animate-shimmer (DT-1) | RESOLVIDO 2026-03-30 |
| A2 | 2026-03-08 | BAIXO | Audits.tsx | ~~key={i}~~ → key={`recipient-${r.value \|\| i}`} (DT-1) | RESOLVIDO 2026-03-30 |
| O1 | 2026-03-08 | BAIXO | useAuditRules.ts | ~~unknown~~ → string[] (DT-1) | RESOLVIDO 2026-03-30 |
| M11b | 2026-03-26 | BAIXO | AgendasPage, CreateAgendaDialog | ~~useQuery importado sem uso~~ → removido (DT-1) | RESOLVIDO 2026-03-30 |
| DSb1 | 2026-03-26 | BAIXO | SatisfactionPicker.tsx | ~~Cores hardcoded~~ → importa SATISFACTION_CONFIG (DT-1) | RESOLVIDO 2026-03-30 |
| DSb2 | 2026-03-26 | BAIXO | AgendasPage.tsx | ~~Sem animate-fade-in-up~~ → classe adicionada (DT-1) | RESOLVIDO 2026-03-30 |

## Resolvidas (desde última auditoria)

| ID | Data | Descrição | Resolução |
|----|------|-----------|-----------|
| A1 | 2026-03-08 | SearchPage.tsx TDZ | Issue #65 — fix aplicado |
| A3 | 2026-03-08 | CONTEXT.md Issue #13 inconsistente | CONTEXT.md v21 corrigido |
| O3 | 2026-03-08 | queryKey sem `limit` | Reclassificado como sem impacto |
| O4 | 2026-03-08 | Agente "Projeto" na Colaboração | Informacional — coexistem |
| O5 | 2026-03-08 | Changelog v8→v9 ausente | Informacional |
