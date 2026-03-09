# Auditoria PRD vs Implementação — CX Hub uMode

> **Data:** 2026-03-08  
> **Autor:** Claude Code  
> **Referências:** docs/PRD.md (v2.2), CONTEXT.md (v17)

---

## 1. Resumo executivo

O PRD descreve o CX Hub como hub analítico e de auditoria com ingestão multi-canal, classificação por IA (Gemini), jobs persistidos, auditorias e alertas. A implementação atual cobre a maior parte das fases 0–6 e Sprints P1–P4. As principais lacunas são: **documentação do PRD desatualizada** em relação ao que foi construído, **Feed de Interações** não entregue como página dedicada com filtros avançados e painel de detalhe + Reclassificar, e **entrega de alertas** (SMTP/WhatsApp) adiada. O **modelo de IA** em produção é `gemini-2.5-pro` (não Flash), o que não está refletido no PRD.

---

## 2. PRD vs realidade (por seção)

### 2.1 Stack e arquitetura (PRD §2)

| Item PRD | Estado | Observação |
|----------|--------|------------|
| IA: gemini-2.5-**flash** | **Desalinhado** | Em produção: **gemini-2.5-pro** (decisão definitiva, blind test 9.0/10). PRD ainda cita Flash em §2.1, §6.1, §12, §14. |
| Fallback claude-sonnet-4 | ✅ | Implementado. |
| sync_jobs + pg_cron | ✅ | process-jobs, auto-chain, since_timestamp. |
| Batch máx 5 páginas / 300 regs | ✅ | Respeitado. |
| Anti-padrões proibidos | ✅ | Respeitados (sem loop React, sem localStorage para progress, etc.). |

### 2.2 Modelo de dados (PRD §3)

| Item PRD | Estado | Observação |
|----------|--------|------------|
| clients, channel_bindings, participants, interactions | ✅ | Schema alinhado. |
| clients.status | ✅ | Adicionado (Fase 6.5) — ativo/trial/inativo. PRD §3.1 não cita; CONTEXT documenta. |
| sync_jobs | ✅ | Tipos e payload (progress, since_timestamp). |
| audit_rules, audit_alerts | ✅ | Incl. RLS, seed, unique client_id+metric. |
| client_priority_config, priority_scores | ✅ | Fase 5 — não no PRD §3; documentado em CONTEXT. |
| audit_alerts.delivered_at, delivery_status | ✅ DB | Colunas existem; entrega (deliver) não implementada (Edge adiada). |

### 2.3 Jobs e sincronização (PRD §4)

| Item PRD | Estado | Observação |
|----------|--------|------------|
| UI: jobs ativos com barra de progresso | ✅ | DashboardLayout (SyncProgressBar) + Settings (Sincronização). |
| Últimos 20 jobs concluídos/falhados | ✅ | Settings: tabela sync_jobs_history. |
| Botão Retentar (falhados) | ✅ | SettingsPage. |
| Botão Cancelar (pendentes/rodando) | ✅ | cancelSync no ClientContext + UI. |

### 2.4 Frontend — telas (PRD §8)

| Tela PRD | Status no PRD | Estado real | Lacuna |
|----------|----------------|------------|--------|
| Login / Auth | ✅ | ✅ | — |
| Sidebar + Layout | ✅ | ✅ | — |
| ClientsPage | ✅ | ✅ | — |
| ClientDetailPage (6 tabs) | ✅ | ✅ (tabs: Visão Geral, Participantes, Canais, Interações, Regras de Negócio, Configurações) | Tab Tasks removida (PR #48); PRD ainda cita "Tasks 🔒". |
| Configurações → Integrações | ✅ | ✅ | — |
| Configurações → Sincronização | ✅ | ✅ | — |
| **InteractionsPage (feed)** | 🔄 Parcial | **Parcial** | Feed existe como **InteractionsFeed** dentro de ClientDetailPage (por cliente). **Não existe** rota `/interactions` nem página dedicada com: filtros (canal, tom, tema, lado, período, busca), painel lateral (detalhes + raw_payload + "Reclassificar"), paginação infinita. Busca global em SearchPage não substitui esse fluxo. |
| **Dashboard** | ⏳ Pendente | **Implementado (outro desenho)** | PRD §8.2 descreve **Dashboard operacional**: 6 KPIs (total interações, mensagens hoje, alertas/críticos, % fora escopo, tempo médio resposta, fora de horário), volume 30d, distribuição por tema, heatmap hora×dia, últimas 5 toms ≠ ok. **Implementado:** Dashboard de **Prioridade** (Index): ranking por score, tier, patterns, KPIs globais (total_clients_monitored, etc.), gráficos de tendência e temas, filtro por nome/tier. Ou seja: dois desenhos diferentes; o PRD não foi atualizado para o Dashboard de Prioridade. |
| **Auditorias** | ⏳ Pendente | **Implementado** | Tabs "Alertas" (lista de audit_alerts) e "Regras" (CRUD audit_rules). PRD §8.5 cita "Histórico" com status de **entrega**; hoje a UI mostra apenas Lido/Não lido (read), não delivery_status/delivered_at. |

### 2.5 Feed de Interações (PRD §8.3) — detalhe da lacuna

| Requisito PRD | Implementado | Onde |
|---------------|--------------|------|
| Filtros: canal, tom, tema, lado, período, busca por texto | Parcial | ClientDetailPage: InteractionsFeed com paginação; filtros limitados. SearchPage: busca full-text + cliente + tom. Não há uma única página com todos os filtros listados. |
| Timeline com ícone canal, badge lado, conteúdo truncado, badges tom/tema | ✅ | InteractionsFeed. |
| Paginação infinita | ✅ | Paginação por página (não infinita) em InteractionsFeed. |
| Painel lateral ao clicar: detalhes + raw_payload + "Reclassificar" | ❌ | Não implementado. |
| Botão "Reclassificar" | ❌ | Não implementado. |

### 2.6 Auditorias e alertas (PRD §7, §8.5)

| Item | Estado | Observação |
|------|--------|------------|
| Métricas (tone_critico_count, volume_daily, etc.) | ✅ | evaluate-audit-rules + METRIC_CONFIG na UI. |
| Regras padrão (seed) | ✅ | 39 regras (3 métricas × 13 clientes); PRD mostra 5 genéricas. |
| UI Regras (CRUD) | ✅ | Tab Regras em Audits.tsx (PR #62). |
| UI Histórico / status de entrega | Parcial | Tab Alertas mostra alertas com Lido/Não lido; **não** exibe delivery_status nem delivered_at. |
| Entrega (SMTP + WhatsApp) | ❌ | Edge Function deliver-audit-alerts adiada (Lovable S6, baixa prioridade). |

### 2.7 Fases (PRD §9)

| Fase PRD | Status no PRD | Estado real |
|----------|----------------|------------|
| 0 Fundação | ✅ | ✅ |
| 1 Dados reais | ✅ | ✅ |
| 2 Job queue | ✅ | ✅ |
| 3 Classificação IA | ✅ Em execução | ✅ (Gemini Pro, Mega Agente v6, blind test 9.0). PRD ainda marca "Validar qualidade" e "Dashboard com dados classificados" como ⏳. |
| 4 Feed de Interações | Não concluída | Parcial: feed por cliente + busca global; falta página dedicada + painel lateral + Reclassificar. |
| 5 Auditorias e alertas | Não concluída | Backend + UI Regras/Alertas ✅; entrega (deliver) ❌. |
| 6 Novas integrações | Futuro | Não escopo atual. |
| 7 Polimento | Futuro | Relatórios, Tasks, Whisper etc. |

---

## 3. Documentação desatualizada

- **PRD §2.1 e §6:** Modelo citado como `gemini-2.5-flash`; produção usa `gemini-2.5-pro`.
- **PRD §8.1:** Dashboard e Auditorias marcados como ⏳; ambos implementados (em formato distinto no caso do Dashboard).
- **PRD §8.2:** Descrição do Dashboard Principal (operacional) não reflete o Dashboard de Prioridade atual.
- **PRD §8.4:** Menção à tab "Tasks 🔒" — tab removida.
- **PRD §9 Fase 3:** Itens "Validar qualidade" e "Dashboard com dados classificados" estão concluídos.
- **PROJECT_STATUS.md:** Muito antigo (estado sem auth, Gist KPIs, placeholders); CONTEXT.md é a fonte de verdade.

---

## 4. Lacunas de produto/funcionalidade

| # | Lacuna | Prioridade | Responsável sugerido |
|---|--------|------------|----------------------|
| L1 | Feed de Interações como página dedicada com filtros completos + painel lateral + Reclassificar | Alta (PRD §8.3, Fase 4) | Lovable (UI) + Cursor (fluxo Reclassificar pode envolver Edge ou RPC) |
| L2 | Exibir status de entrega (delivery_status / delivered_at) na tab Alertas | Média | Cursor (UI) |
| L3 | Entrega de alertas (SMTP + WhatsApp) — Edge deliver-audit-alerts | Média (adiada) | Lovable |
| L4 | Dashboard operacional do PRD (6 KPIs operacionais, volume 30d, heatmap) vs atual Dashboard de Prioridade | Baixa (decisão de produto) | Produto: decidir se mantém só Prioridade ou adiciona visão operacional |
| L5 | Atualizar PRD (modelo Pro, status das fases, remover Tasks, refletir Dashboard atual) | Média | Claude Code (doc) |

---

## 5. Plano de ações — quem faz o quê

### 5.1 Claude Code (revisão, docs, issues, scripts)

| Ação | Descrição | Prioridade |
|------|-----------|------------|
| **Atualizar PRD** | Alterar gemini-2.5-flash → gemini-2.5-pro em todo o doc; marcar Fase 3 como concluída; atualizar §8.1 (Dashboard ✅, Auditorias ✅); remover Tasks 🔒; opcional: adicionar § curto descrevendo Dashboard de Prioridade e que o Dashboard operacional (§8.2) fica como referência futura. | Média |
| **Atualizar PROJECT_STATUS.md** | Ou marcar como "Substituído por CONTEXT.md" e redirecionar, ou reescrever uma página de status resumida alinhada a CONTEXT. | Baixa |
| **Issue para L1 (Feed completo)** | Criar Issue no GitHub com escopo claro: rota `/interactions` (ou manter dentro de cliente?), filtros (canal, tom, tema, lado, período, busca), painel lateral com detalhes + raw_payload, botão Reclassificar (especificar se chama Edge/RPC e se reclassificação é por mensagem ou por conversa). Incluir checklist CTO aplicável e referência ao PRD §8.3. | Alta |
| **Issue para L2 (Status de entrega)** | Coluna(s) na tab Alertas para delivery_status e/ou delivered_at; contrato da função `audit_alerts_summary` (ou da view usada) para incluir esses campos se ainda não retornados. | Média |
| **Checklist E2E** | Após L1/L2, adicionar casos no E2E_TEST_PLAN.md para Feed (filtros, painel, Reclassificar) e para exibição de status de entrega em Alertas. | Média |

### 5.2 Lovable (migrations, edge functions, deploy)

| Ação | Descrição | Prioridade |
|------|-----------|------------|
| **L3 — deliver-audit-alerts** | Implementar Edge Function que lê audit_alerts com delivery_status=pending, envia por SMTP/WhatsApp conforme audit_rules.alert_channel e alert_recipients, atualiza delivered_at e delivery_status. Depende de decisão sobre canal (Z-API, Evolution, etc.) e env vars. | Média (quando decidido) |
| **Suporte a L1 (se necessário)** | Se Reclassificar exigir novo endpoint ou alteração em classify-batch (ex.: reclassificar uma conversa sob demanda), implementar conforme Issue criada pelo Claude Code. | Alta (se escopo da Issue incluir backend) |
| **Não fazer** | Não alterar schema nem tipos em `src/integrations/supabase/` sem migration; não editar PRD/CONTEXT/AGENTS. | — |

### 5.3 Cursor (frontend, em sessões orientadas por Issue)

| Ação | Descrição | Prioridade |
|------|-----------|------------|
| **Implementar L1** | Página Feed de Interações (ou ampliar ClientDetailPage) conforme Issue: filtros, painel lateral, Reclassificar. Usar Design System e checklist CTO. | Alta (quando Issue estiver aberta) |
| **Implementar L2** | Incluir delivery_status (e opcionalmente delivered_at) na tab Alertas; garantir que a fonte de dados (RPC/view) retorne esses campos. | Média |

### 5.4 Operador (João) / Produto

| Ação | Descrição |
|------|------------|
| **Decisão L4** | Confirmar se o produto fica só com Dashboard de Prioridade ou se deseja também a visão operacional do PRD §8.2 (KPIs operacionais, volume 30d, heatmap). |
| **Decisão L3** | Aprovar canal e env vars para entrega de alertas (SMTP já previsto; WhatsApp: Z-API vs Evolution etc.) e priorizar Lovable S6. |

---

## 6. Ordem sugerida de execução

1. **Claude Code:** Atualizar PRD (modelo Pro, fases, §8.1, Tasks) e criar Issue L1 (Feed completo).
2. **Claude Code:** Criar Issue L2 (status de entrega na tab Alertas).
3. **Cursor:** Implementar L2 (rápido; só UI + contrato de dados).
4. **Produto/Operador:** Decisões L4 (Dashboard) e L3 (canal de alertas).
5. **Cursor:** Implementar L1 a partir da Issue (e Lovable apoiar se houver backend para Reclassificar).
6. **Lovable:** Implementar L3 quando canal e prioridade estiverem definidos.
7. **Claude Code:** Atualizar E2E_TEST_PLAN e PROJECT_STATUS conforme entregas.

---

## 7. Conclusão

A implementação está alinhada ao PRD nas fases 0–3 e na maior parte da 5–6 (backend + UI de regras/alertas). As principais divergências são: **(1)** PRD desatualizado (modelo, status de telas, Tasks, Dashboard); **(2)** Feed de Interações não entregue como página dedicada com painel lateral e Reclassificar; **(3)** entrega de alertas (SMTP/WhatsApp) adiada; **(4)** status de entrega não exibido na UI. O plano acima distribui ações entre Claude Code (docs + issues), Lovable (entrega de alertas e eventual backend do Reclassificar) e Cursor (Feed completo + status de entrega na tab Alertas), com decisões de produto para Dashboard operacional e canal de alertas.
