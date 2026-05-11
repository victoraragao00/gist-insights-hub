## Diagnóstico

### 1) Erro RLS ao editar projeto
A policy `projects_update` só permite quando `owner_id = auth.uid()`. Quem não é dono (admin, membro do squad, etc.) recebe `new row violates row-level security policy`.

### 2) Notificações de menções/demandas não chegam
A tabela `demand_notifications` tem RLS habilitado, mas **não existe policy de INSERT**. Resultado: todo `insert` é rejeitado silenciosamente (o frontend só faz `console.error`). A tabela está com **0 linhas** — nenhuma notificação foi gravada até hoje.

---

## Plano

### Migration 1 — Liberar UPDATE de projetos

Atualizar `projects_update` para permitir:
- **Owner** do projeto, **OU**
- **Admin** global (`is_admin()`), **OU**
- **Membro** do squad (`project_members`)

```sql
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  );
```

> DELETE permanece restrito ao owner (não foi pedido alterar).

### Migration 2 — Permitir INSERT em demand_notifications

Adicionar policy de INSERT para usuários autenticados (o autor da notificação não precisa ser o destinatário — quem comenta avisa outros):

```sql
CREATE POLICY demand_notifications_insert ON public.demand_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
```

SELECT/UPDATE atuais já garantem que cada usuário só lê/marca como lida as próprias notificações.

---

## Verificação após aplicar

1. Editar campos de um projeto como admin ou membro do squad — não deve mais dar erro RLS.
2. Comentar em uma demanda mencionando outro usuário (`@`) — o destinatário deve ver o sino piscar (realtime já está configurado em `useDemandNotifications`).
3. Trocar `assignee_id` de uma demanda — o novo responsável deve receber notificação tipo `assigned`.

Nenhuma alteração de frontend é necessária — os hooks (`useUpdateProject`, `createDemandNotification`, `createMentionNotifications`) já estão corretos; só faltava o RLS permitir as escritas.