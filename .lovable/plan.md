

## Plan: Atualizar CONTEXT.md com alterações recentes (v26)

### Alterações a documentar

Based on the conversation history, the following changes were made since v25 (2026-03-31):

**1. Conversas Vinculadas — Resumo IA + Cards (2026-04-01)**
- Tabela `demand_conversation_summaries` criada (demand_id, conversation_id, summary, generated_at, created_by)
- Edge Function `summarize-conversation` — usa Lovable AI Gateway (google/gemini-2.5-flash) para gerar resumos
- Hook `useDemandConversationSummaries.ts` — query + mutation para resumo IA
- DemandDetailSheet redesenhado: cards por conversa (contato + data + qtd msgs), botão "Resumir com IA", HTML rendering fix
- LinkConversationDialog: opção "Vincular inteira" além de selecionar mensagens

**2. Dashboard Demandas — Fix contadores + KPIs clicáveis (2026-04-01)**
- RPC `get_demand_analytics` corrigida: cancelled = `cancellation_reason IS NOT NULL` (prioridade sobre completed), open exclui cancelled
- Novo KPI "Cancelados" no DemandsDashboardPage
- KPIs clicáveis: modal drill-down com tabela de tickets (open, completed, blocked, cancelled)

**3. Abas Documentos e Regras de Negócio (2026-04-01)**
- Tabela `client_documents` (client_id, doc_type link/file, title, url, description, storage_path)
- Tabela `client_rules` (client_id, description, category, active)
- Storage bucket `client-documents` com RLS
- Hooks: `useClientDocuments.ts`, `useClientRules.ts`
- Componentes: `ClientDocumentsTab.tsx`, `ClientRulesTab.tsx`
- ClientDetailPage: placeholders substituídos por abas funcionais

**4. Onboarding sem acesso automático a clientes (2026-04-01)**
- Trigger `grant_new_client_to_all_users()` alterado: só concede acesso a admins
- Edge Function `bootstrap-user-access`: non-admins não recebem auto-grant
- Novos usuários (gerentes de contas) entram sem acesso a clientes — admin configura via Permissões

**5. FK fixes para deleção de demandas (2026-04-01)**
- `rfis.demand_id` → `ON DELETE CASCADE` (RFI deletada junto com demanda)
- `meeting_homework_items.converted_to_demand_id` → `ON DELETE SET NULL` (homework preservado, referência limpa)

**6. DemandDetailSheet — UI do botão Criar RFI (2026-04-01)**
- Seção RFI redesenhada: card destacado com ícone, badge de status, botão mais visível

### Edições no arquivo

| Seção | Mudança |
|-------|---------|
| Header | v25 → v26, data 2026-04-01, updated_by Lovable |
| Estado das Fases | Adicionar Fase 7.6 (Conversas IA + Docs/Rules + Contadores) |
| Nova seção | Fase 7.6 — detalhes das 6 features acima |
| Proximos Passos | Adicionar itens 28-33 (concluídos) |
| Estrutura de Pastas | Adicionar `summarize-conversation/` e `clients/` componentes |

### Files changed

| Action | File |
|--------|------|
| Edit | `CONTEXT.md` (atualizar para v26 com todas as alterações recentes) |

