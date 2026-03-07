

## Diagnóstico de Segurança — 2 Warnings Pré-existentes

---

### Warning 1: RLS `app_settings` — UPDATE aberto

**Policies atuais:**

| Policy | Command | Restrictive | Expression |
|--------|---------|-------------|------------|
| `app_settings_read` | SELECT | Yes | `true` (qualquer autenticado lê) |
| `app_settings_update` | UPDATE | Yes | `true` (qualquer autenticado altera) |

**Problema:** A policy `app_settings_update` usa `USING (true)`, permitindo que qualquer usuário autenticado altere qualquer configuração do sistema (ex: `default_stale_days`, `sync_interval`).

**Correção proposta:** Substituir a policy de UPDATE para restringir a usuários com role `admin` em `user_client_access`:

```sql
DROP POLICY "app_settings_update" ON app_settings;

CREATE POLICY "app_settings_update" ON app_settings
  FOR UPDATE TO authenticated
  AS RESTRICTIVE
  USING (
    EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

### Warning 2: Leaked Password Protection Disabled

**Não é uma senha exposta no código.** O scan detectou que a funcionalidade **Leaked Password Protection** do sistema de autenticação está **desabilitada**. Esta feature verifica se senhas usadas no signup/login aparecem em bancos de dados de senhas vazadas (HaveIBeenPwned).

**Correção proposta:** Ativar via `configure_auth` tool — é uma configuração do backend de autenticação, não requer mudança de código.

---

### Resumo

| Warning | Tipo | Correção |
|---------|------|----------|
| `app_settings` UPDATE | Policy RLS aberta | Migration SQL — restringir a admins |
| Leaked password | Feature de auth desabilitada | Configuração do backend auth |

Nenhuma senha ou chave está exposta no código-fonte. Confirma para implementar ambas as correções?

