# Sessao 1 — RLS Policies para audit_rules e audit_alerts

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: CRITICA

Leia CONTEXT.md antes de comecar.

## Tarefa: RLS Policies para audit_rules e audit_alerts

As tabelas `audit_rules` e `audit_alerts` foram criadas sem RLS policies. Isso e uma falha de seguranca — qualquer usuario autenticado pode ver/editar regras e alertas de todos os clientes.

### audit_rules

```sql
ALTER TABLE audit_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario so ve regras dos clientes que tem acesso
CREATE POLICY "Users can view audit rules for accessible clients"
  ON audit_rules FOR SELECT
  USING (client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid()))));

-- INSERT: apenas admin
CREATE POLICY "Admins can create audit rules"
  ON audit_rules FOR INSERT
  WITH CHECK (
    client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid())))
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- UPDATE: apenas admin
CREATE POLICY "Admins can update audit rules"
  ON audit_rules FOR UPDATE
  USING (
    client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid())))
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- DELETE: apenas admin
CREATE POLICY "Admins can delete audit rules"
  ON audit_rules FOR DELETE
  USING (
    client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid())))
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### audit_alerts

```sql
ALTER TABLE audit_alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario so ve alertas dos clientes que tem acesso
CREATE POLICY "Users can view audit alerts for accessible clients"
  ON audit_alerts FOR SELECT
  USING (client_id IN (SELECT unnest(user_accessible_client_ids(auth.uid()))));

-- INSERT: apenas service_role (evaluate-audit-rules usa service_role_key)
-- Nenhuma policy de INSERT necessaria para usuarios — insercao e feita via Edge Function com service_role
```

### IMPORTANTE

- `user_accessible_client_ids()` retorna `uuid[]` — DEVE usar `unnest()` para comparar com `uuid`
- Nao criar policies de INSERT/UPDATE/DELETE em audit_alerts para usuarios comuns
- Testar que viewer consegue SELECT mas nao INSERT/UPDATE/DELETE em audit_rules

### Nao fazer

- Nao alterar estrutura das tabelas
- Nao alterar Edge Functions
- Nao alterar outras policies existentes

### Frontend Contract

Nenhum — RLS e transparente para o frontend.
