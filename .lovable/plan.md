## Plano: Base de dados para múltiplos colaboradores e tipos de bloqueio

Executar 3 migrations isoladas no Supabase, sem alterações de frontend nesta sessão.

### Migration 1 — `demand_collaborators`
- Tabela com `demand_id` (FK demands, CASCADE), `user_id` (FK user_profiles, CASCADE), `added_by` (FK user_profiles, SET NULL), `added_at`.
- UNIQUE `(demand_id, user_id)`.
- Índices em `demand_id` e `user_id`.
- RLS habilitada com policies SELECT/INSERT/DELETE via `user_accessible_client_ids(auth.uid())` usando `IN (SELECT ...)`.
- COMMENT explicando que owner principal continua em `demands.assignee_id` e que subdemandas (`demand_tasks`) não têm colaboradores.

### Migration 2 — `blocker_types`
- Tabela com `name`, `color` (default `#E24B4A`), `icon` (default `🔒`), `active`, `position`, `created_at`.
- Índice `(active, position)`.
- RLS: SELECT para qualquer autenticado; INSERT/UPDATE/DELETE apenas para `global_role = 'admin'`.
- Seed (ON CONFLICT DO NOTHING) com 5 categorias padrão: Aguardando cliente, Dependência técnica, Infra/Ambiente, Aguardando decisão, Dependência externa.

### Migration 3 — `demands.blocker_type_id`
- Adiciona coluna nullable `blocker_type_id UUID REFERENCES blocker_types(id) ON DELETE SET NULL`.
- Índice parcial `WHERE blocker_type_id IS NOT NULL`.
- COMMENT esclarecendo coexistência com `blocker_reason` (texto livre).

### Decisões preservadas
- `demands.assignee_id` permanece intocado (owner principal).
- Nenhuma migração de dados de assignee atual para `demand_collaborators` será feita — o prompt menciona migrar como 'owner', mas a tabela `demand_collaborators` definida no SQL não possui coluna `role`. Manter apenas o que está no SQL literal (sem coluna role, sem backfill), já que o owner continua representado por `demands.assignee_id`. **Confirmação necessária**: seguir estritamente o SQL fornecido (sem backfill de colaboradores) — o texto "OBRIGATÓRIO migrar como owner" é incompatível com o schema definido.

### Verificação pós-deploy
Executar as 4 queries de verificação fornecidas: RLS habilitada nas duas novas tabelas, 5 linhas em `blocker_types`, coluna `blocker_type_id` presente em `demands`, e os 4 índices criados.

### Arquivos
- Apenas migrations SQL via migration tool. Nenhum arquivo de código alterado.
