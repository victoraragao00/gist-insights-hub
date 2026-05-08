## Excluir projeto

Hoje só existe **Cancelar projeto** (soft — `cancel_project` RPC marca `cancelled_at`). O usuário precisa também conseguir **excluir** definitivamente.

A RLS já permite: `projects_delete` policy autoriza `DELETE` para o `owner_id = auth.uid()`. As FKs já estão preparadas:
- `project_members.project_id` → `ON DELETE CASCADE`
- `demands.project_id` → `ON DELETE SET NULL` (demandas vinculadas perdem o vínculo, não são apagadas)
- `meeting_agendas.project_id` → `ON DELETE SET NULL`

Ou seja, **nenhuma migration é necessária**. Só falta UI + hook.

### Mudanças

**`src/hooks/useProjects.ts`**
- Adicionar `useDeleteProject()` mutation: `supabase.from("projects").delete().eq("id", id)`. Em sucesso, invalidar `["projects"]`, `["project_demands"]`, `["unassigned_demands"]`, `["demands"]`, `["agendas"]` e mostrar toast.

**`src/pages/ProjectDetailPage.tsx`**
- Ao lado do botão "Cancelar projeto" (linha ~337), adicionar botão **"Excluir projeto"** (variante destructive/ghost, ícone `Trash2`), visível apenas para `isOwner`.
- Envolver em `AlertDialog` com texto explicando que a ação é **permanente**, que demandas vinculadas serão **desvinculadas** (não apagadas) e reuniões internas perderão o vínculo.
- Ao confirmar: chamar `deleteProject.mutateAsync({ id })` e em seguida `navigate("/projects")`.

### Verificação
- Owner abre projeto → vê "Excluir projeto" → confirma → volta para `/projects`, projeto sumiu da lista.
- Demandas que estavam no projeto continuam existindo, agora sem `project_id`, e voltam a aparecer em "Demandas não vinculadas".
- Não-owner não vê o botão (e o RLS bloquearia mesmo se forçado).
