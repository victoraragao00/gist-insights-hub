

## Análise do SQL proposto para `sync_jobs`

### Veredito: **Quase correto, mas precisa de 3 ajustes**

---

### 1. FK para `auth.users` — **Problema**

```sql
created_by UUID REFERENCES auth.users(id)
```

O projeto segue o padrão de **nunca** referenciar `auth.users` diretamente com FK. Isso causa problemas com o schema gerenciado pelo Supabase. Remover a FK constraint e manter apenas o campo UUID:

```sql
created_by UUID  -- sem REFERENCES auth.users(id)
```

---

### 2. RLS SELECT policy — **Problema de recursão potencial**

```sql
CREATE POLICY sync_jobs_access ON sync_jobs FOR SELECT USING (
  created_by = auth.uid()
  OR client_id IN (SELECT client_id FROM user_client_access WHERE user_id = auth.uid())
);
```

O projeto já tem a função `user_accessible_client_ids(auth.uid())` como SECURITY DEFINER para evitar problemas com RLS. Usar o padrão existente e tornar a policy **RESTRICTIVE** (padrão do projeto):

```sql
CREATE POLICY sync_jobs_access ON sync_jobs FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR client_id IN (SELECT user_accessible_client_ids(auth.uid()))
);
```

---

### 3. INSERT policy — **Falta `TO authenticated`**

Adicionar `TO authenticated` para consistência e segurança (impede acesso anon):

```sql
CREATE POLICY sync_jobs_insert ON sync_jobs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
```

---

### 4. Enums e conflitos — **OK**

- `job_status` e `job_type` não existem no banco atual (enums existentes: `channel_type`, `interaction_type`, `tone_severity`, `alert_channel`).
- Tabela `sync_jobs` não existe.
- Índices não conflitam.

---

### 5. Faltando UPDATE policy

As edge functions precisam atualizar `status`, `progress`, `started_at`, `completed_at`. Sem policy de UPDATE, isso só funciona via service_role. Se as edge functions já usam service_role key (que é o caso atual), está OK. Mas se quiser permitir cancelamento pelo frontend, precisa de:

```sql
CREATE POLICY sync_jobs_update ON sync_jobs FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
```

---

### Recomendação

**Não executar direto no SQL editor.** Usar a migration tool do Lovable para que o schema fique versionado e o `types.ts` seja atualizado automaticamente. Se rodar direto, os tipos TypeScript não serão gerados e o frontend não terá autocomplete para a tabela.

Posso implementar isso com a migration tool na próxima mensagem — basta aprovar.

