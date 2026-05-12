## Problema

Hoje o squad de um projeto só pode ser editado pelo **Owner**. Como gestor de projetos (admin do CX Hub), você precisa adicionar/remover membros mesmo sem ser owner do projeto.

A restrição existe em duas camadas:

1. **Frontend** — `ProjectSquadTab` recebe apenas `isOwner` e esconde o `UserSelect` e o botão de remover.
2. **RLS** — As policies `project_members_insert` e `project_members_delete` só permitem quando `auth.uid() = projects.owner_id`.

A troca de owner já considera admin (`canManageOwner = isOwner || isAdmin`), mas o squad ficou de fora.

## Mudanças

### 1. RLS — `project_members` (migration nova)

Substituir as policies de INSERT e DELETE para permitir owner **ou** admin global:

```sql
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
    OR public.is_admin(auth.uid())
  );
```

(Usar a função `is_admin()` já existente no projeto, conforme padrão de RLS recursion prevention.)

### 2. Frontend — `ProjectDetailPage.tsx`

Trocar a prop passada para o squad de `isOwner={isOwner}` para `canManage={canManageOwner}` (que já é `isOwner || isAdmin`).

### 3. `ProjectSquadTab.tsx`

Renomear a prop `isOwner` para `canManage` e usá-la para gating do `UserSelect` (adicionar membro) e do botão `UserMinus` (remover membro). Sem mudanças visuais.

## Arquivos

- **Nova migration** — atualiza policies de `project_members`
- **`src/pages/ProjectDetailPage.tsx`** — passa `canManage` para o squad
- **`src/components/projects/tabs/ProjectSquadTab.tsx`** — aceita `canManage` em vez de `isOwner`

## Fora de escopo

Outros gates `isOwner` (editar título, datas, cliente, deletar projeto, criar RFI) — você não pediu para abrir esses para admin. Se quiser, posso incluir num próximo passo.