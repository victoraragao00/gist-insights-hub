## Sprint TECH 3-A — Squads (Banco)

Executar 4 migrations + seed na ordem definida no prompt.

### Migrations
1. **`demands.workspace`** — TEXT NOT NULL DEFAULT 'cx', CHECK in ('cx','tech'), backfill `'cx'`, index `idx_demands_workspace`, comentário.
2. **`squads`** — tabela global (id, name, color, active, position, timestamps), trigger `update_squads_updated_at`, RLS: SELECT autenticado, INSERT/UPDATE/DELETE apenas admin (via `user_profiles.global_role = 'admin'`).
3. **`squad_members`** — FK squads + user_profiles, role lead/member, UNIQUE(squad_id,user_id), índices, RLS: SELECT autenticado, INSERT/DELETE apenas admin.
4. **`demands.squad_id`** — UUID nullable FK squads ON DELETE SET NULL, partial index where not null, comentário.

### Seed
INSERT 2 squads (`Integrações` #7F77DD pos 1, `Produto` #1D9E75 pos 2) com `ON CONFLICT DO NOTHING`.

### Entrega
Uma única migration SQL contendo todos os blocos acima copiados literalmente do prompt. Sem alterações em frontend, docs ou outros arquivos.

### Verificação pós-deploy
Rodar as 5 queries de verificação do prompt no Supabase para confirmar colunas, RLS, backfill, seed e índices.
