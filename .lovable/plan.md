## Objetivo

1. Admins (não-owners) podem editar todos os campos do sidebar do projeto: Owner, Cliente, Data de entrega, Datas (previstos/reais), Horas planejadas, Cancelar e Excluir projeto, além do título.
2. Comentários de demanda passam a aceitar imagens (paste/drag/clique) e anexos (arquivos), assim como já acontece na descrição.

---

## Parte 1 — Permissões do sidebar do projeto

Arquivo: `src/pages/ProjectDetailPage.tsx`

Trocar a regra `isOwner` por `canManageOwner` (= `isOwner || isAdmin`) nos pontos abaixo:

- Edição inline do **título** (linhas 130 e 149-151).
- `<ProjectClientField canEdit={isOwner}>` → `canEdit={canManageOwner}`.
- `<ProjectDatesSection canEdit={isOwner}>` → `canEdit={canManageOwner}`.
- Bloco "Ações" (Cancelar/Excluir, condicional `{isOwner && ...}`) → `{canManageOwner && ...}`.
- `<HoursEditField>`: aceitar prop `canEdit` e renderizar como texto estático quando false. Passar `canEdit={canManageOwner}`.
- `<ProjectDueDateField>`: aceitar prop `canEdit` e tornar o campo somente leitura quando false. Passar `canEdit={canManageOwner}`.

Não mexer em RFIs (`canCreate={isOwner}`) — fora do escopo da tela mostrada.

Backend (RLS): a migration anterior já liberou `project_members` para admins. Verificar que a policy de `UPDATE` em `projects` também aceita admin (`is_admin(auth.uid())`). Se ainda exigir owner, adicionar via migration:

```sql
DROP POLICY IF EXISTS "Owners or admins update project" ON public.projects;
CREATE POLICY "Owners or admins update project" ON public.projects
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = owner_id OR public.is_admin(auth.uid()));
```

Mesma checagem para `DELETE` (cancelar/excluir).

---

## Parte 2 — Anexos e fotos em comentários

A descrição já usa `RichTextEditor` (paste/drag de imagens + bucket `demand-attachments`). Replicar nos comentários sem perder o autocomplete de menções (`@usuario`).

### 2.1 Banco

Nova tabela `demand_comment_attachments` (espelho de `demand_attachments`, mas vinculada ao comentário):

```sql
CREATE TABLE public.demand_comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.demand_comments(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('file','link')),
  url text NOT NULL,           -- file: storage path; link: URL
  filename text, size_bytes bigint, mime_type text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.demand_comment_attachments (comment_id);
ALTER TABLE public.demand_comment_attachments ENABLE ROW LEVEL SECURITY;
-- RLS: usa as mesmas regras de leitura/escrita já aplicadas a demand_comments
-- (SELECT/INSERT/DELETE espelhando a policy existente).
```

Reutilizar o bucket `demand-attachments` já existente (privado + signed URLs).

### 2.2 Hook

Novo `src/hooks/useDemandCommentAttachments.ts` com:

- `useCommentAttachments(commentIds: string[])` — busca anexos para uma lista de comentários e devolve um mapa `commentId → DemandCommentAttachment[]`. QueryKey inclui IDs ordenados.
- `useUploadCommentAttachments()` — recebe `{ commentId, demandId, files }`, faz upload em `demands/<demandId>/comments/<commentId>/<ts>_<file>` e insere linha.
- `useSignedCommentAttachmentUrls(attachments)` — análogo a `useSignedAttachmentUrls`.
- `useDeleteCommentAttachment()` — remove storage + linha.

### 2.3 UI — input

Arquivo: `src/components/demands/detail/CommentInput.tsx`

- Manter `<Textarea>` + autocomplete de menções (não trocar por RichTextEditor para preservar UX de `@`).
- Adicionar barra de ações abaixo do textarea com botões `Imagem` e `Arquivo` (`<input type="file" multiple>` via `useRef`).
- Suportar paste/drag de imagens diretamente no textarea (capturar `onPaste`/`onDrop` com `clipboardData.files` / `dataTransfer.files`).
- Manter um estado local `pendingFiles: File[]` exibido como chips/thumbs com botão remover, antes de enviar.
- Ajustar `onSubmit`: além de `content` + `mentionedUserIds`, devolver `files: File[]`. O componente pai cria o comentário, recebe o `id` retornado, e dispara `useUploadCommentAttachments` em sequência. Limpar `pendingFiles` ao final.

Atualizar `useCreateComment` para retornar `id` do comentário criado (`.select('id').single()`).

### 2.4 UI — lista de comentários

Arquivo onde os comentários são renderizados (provavelmente `DemandActivityTab.tsx` ou similar — confirmar ao implementar). Para cada comentário:

- Buscar anexos via `useCommentAttachments` (uma query por demanda, agrupada).
- Renderizar abaixo do `<CommentText>`: imagens em grid (thumb 96px) e arquivos como chips com ícone + nome + download. Reusar `AttachmentThumbnail` quando possível.
- Botão remover anexo visível para o autor do comentário e para admins (mesma regra usada para deletar comentário).

### 2.5 Edição de comentário

Manter o fluxo atual (só edita texto). Anexos têm UX própria (adicionar/remover diretamente, sem entrar em modo edição do texto).

---

## Verificação

- Logar como admin não-owner: alterar Owner, Cliente, datas, horas planejadas, cancelar e excluir projeto.
- Em uma demanda: colar imagem no comentário, anexar arquivo, enviar; ver thumbs renderizados; remover anexo; permissão de delete respeitada.
- Confirmar que menções (`@usuario`) e atalho `Ctrl+Enter` continuam funcionando.

## Arquivos

- `src/pages/ProjectDetailPage.tsx` (edição)
- nova migration RLS de `projects` (se necessário)
- nova migration `demand_comment_attachments`
- `src/hooks/useDemandCommentAttachments.ts` (novo)
- `src/hooks/useDemandComments.ts` (retornar `id`)
- `src/components/demands/detail/CommentInput.tsx`
- componente que lista comentários (a localizar — `DemandActivityTab.tsx` ou `DemandConversationsTab.tsx`)
