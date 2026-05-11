## Problemas identificados

### 1. Comentários mostram UUID em vez do nome
Em `src/components/demands/detail/DemandConversationsTab.tsx` (~linhas 260, 265), o autor do comentário é renderizado como:
- Avatar: `(comment.created_by ?? "?")[0]` — primeira letra do UUID (ex: "B" de "48cd703c…")
- Nome: `comment.created_by?.slice(0, 8)` — prefixo do UUID (ex: "48cd703c")

Não há lookup em `user_profiles` para resolver `created_by → full_name/email`.

### 2. UX de menções dentro do comentário
- Após escolher um usuário, o textarea exibe o token cru `@[nome](uuid)` em vez de uma "chip" visual.
- O dropdown de sugestões aparece (CommentInput já tem isso), mas a falta de feedback visual faz o usuário achar que "não está legal".

### 3. Admin não consegue trocar owner de projeto
Em `src/pages/ProjectDetailPage.tsx`:
- `const isOwner = project.owner_id === user?.id;` (linha 97)
- `<ProjectOwnerField canEdit={isOwner} />` (linha 250)

Apenas o owner atual pode trocar — admin global não tem permissão. Além disso, o seletor é `Select` simples (sem busca), o que é ruim com muitos usuários (regra de memória pede `Combobox` para listas grandes).

---

## Plano de correção

### A. Comentários com nome real do autor
Em `DemandConversationsTab.tsx` (componente `CommentItem`):
1. Carregar `user_profiles` (id, full_name, email) — pode ser via `useQuery` com `staleTime: 5min` (mesma chave já usada em `CommentInput`: `["user_profiles_mentions"]` para reaproveitar cache).
2. Resolver autor por `created_by`:
   - Avatar: iniciais de `full_name` (fallback email → "?").
   - Label: `full_name` (ou email, ou "Usuário desconhecido").
   - Manter "Você" quando `created_by === currentUserId`.

### B. UX de menções no comentário
Em `CommentInput.tsx`:
1. Manter o token `@[name](uuid)` no estado interno (necessário para extrair `mentionedUserIds`), mas renderizar visualmente uma "chip" usando uma camada `<div>` posicionada atrás/sobre o `<Textarea>` (técnica de overlay sincronizado), OU
2. Solução mais simples e robusta: substituir o `<Textarea>` por um `contentEditable` controlado que renderize a menção como `<span>` com pílula roxa e armazene o texto + IDs ao serializar.

Recomendação: opção 1 (overlay sincronizado) — menor risco, mantém comportamento atual de `Textarea`/`onSubmit` e só adiciona pintura visual das menções.

Adicionalmente:
- Melhorar o popup de sugestões com avatar, nome e email já existe — apenas garantir que aparece corretamente quando o `@` está no início ou após espaço (o regex `/@(\w*)$/` já cobre isso).
- Em `CommentText` (renderização final), a menção já vira `@Nome` com cor primária — manter.

### C. Admin pode trocar owner do projeto
1. Em `ProjectDetailPage.tsx`:
   - Importar `useUserRole` e calcular `const { isAdmin } = useUserRole();`
   - Criar `const canManageOwner = isOwner || isAdmin;`
   - Passar `canEdit={canManageOwner}` para `<ProjectOwnerField />`.
2. Em `ProjectOwnerField`:
   - Trocar o `Select` por `Combobox` (componente já usado no projeto para listas grandes — regra de memória).
   - Mostrar `full_name (email)` nas opções; busca por nome ou email.
   - Toast de sucesso/erro via `sonner` (já implícito em `useUpdateProject`).
3. RLS de `projects`: a policy de UPDATE precisa permitir admin global. Verificar a migration recente que corrigiu RLS de `projects` — se a policy só checa `owner_id = auth.uid()`, adicionar OR via função `is_admin()` (padrão da memória `RLS Recursion Prevention`). Se a policy já permite admin, nada a fazer no banco.

### Arquivos afetados
- `src/components/demands/detail/DemandConversationsTab.tsx` — resolver autor por `user_profiles`.
- `src/components/demands/detail/CommentInput.tsx` — overlay visual para menções.
- `src/pages/ProjectDetailPage.tsx` — `isAdmin || isOwner` para owner; `Combobox` no seletor.
- (Possível) nova migration: ajuste em policy de UPDATE de `projects` para incluir `is_admin(auth.uid())`.

### Validação pós-deploy
- Comentário criado por outro usuário aparece com nome real e iniciais corretas.
- Ao digitar `@`, popup aparece; ao escolher, surge "chip" visual em vez de texto cru.
- Como admin (não-owner) de um projeto, conseguir trocar o owner via Combobox; toast confirma e a página atualiza.
