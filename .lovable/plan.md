## Problemas

**1. Caret desalinhado no input de comentário** (image 56)
O `CommentInput` usa um truque de overlay: a `<Textarea>` real contém o token `@[laura.delgado](b4fcb1a9-...uuid)` (longo) com texto transparente, e uma camada visual atrás renderiza só `@laura.delgado` (curto). O caret nativo do textarea fica posicionado no final do **token cru**, então aparece deslocado para a direita, longe do texto visível. É um problema fundamental do approach overlay.

**2. Edição mostra `@[name](uuid)` cru** (image 57)
Ao editar um comentário, o textarea de edição usa `comment.content` direto (sem overlay nem conversão), expondo o token bruto.

**3. Imagens da descrição quebram** (image 58)
Em `RichTextEditor.handleImageFile`, após `editor.setImage({ src: signedUrl })`, o atributo `data-storage-path` é adicionado em `queueMicrotask` — DEPOIS que o ProseMirror já disparou `onUpdate`. Resultado: o HTML salvo no banco contém só `<img src="<signedUrl>">` sem `data-storage-path`. Quando a URL assinada expira (1h), o componente não consegue regenerar e a imagem quebra para sempre. Demandas antigas ficam com `<img>` órfão.

---

## Plano

### A. Substituir overlay por mention "plain"

Reescrever `CommentInput.tsx` com abordagem mais simples e robusta:

- **Texto interno** = texto puro com `@nome.usuario` (sem uuid, sem colchetes).
- **Estado paralelo** = `Map<string, userId>` mapeando handle (`nome.usuario`) → uuid, atualizado quando o usuário escolhe da lista.
- **No submit**, varrer o texto, casar cada `@handle` com o map e converter para token `@[label](uuid)` apenas no momento de gravar — preservando o formato existente no banco e a renderização atual de `CommentText`.
- Remover toda a camada `renderHighlightedText`, overlay, `text-transparent`, `caret-foreground`. Caret fica nativo, alinhado ao texto visível.
- Manter o popup de sugestões (já funciona bem) — apenas ajustar a inserção para usar `@handle` em vez de `@[label](uuid)`.
- Como handle, usar a parte antes do `@` do email (ex.: `laura.delgado@umode.tech` → `laura.delgado`); para usuários sem email, slug do `full_name`.

### B. Editor de comentário (modo edição) usa o mesmo input

Em `DemandConversationsTab.CommentItem`, quando `editing === true`:
- Converter `comment.content` (que tem tokens `@[name](uuid)`) para texto plain `@handle` antes de carregar no input.
- Reutilizar o mesmo componente `CommentInput` (extrair em modo "edit" com `initialText` + `onSubmit`/`onCancel`), em vez do `<Textarea>` cru atual.
- No salvar, mesma conversão handle→token.

### C. Corrigir persistência do `data-storage-path` em imagens

Em `RichTextEditor.handleImageFile`:
- Em vez de `setImage({ src, alt })` seguido de microtask que adiciona o atributo, inserir o nó com o atributo já preenchido:
  ```ts
  editor.chain().focus().insertContent({
    type: "image",
    attrs: { src: signedUrl, alt: file.name, "data-storage-path": storagePath },
  }).run();
  ```
- Isso garante que o `onUpdate` (e o save subsequente) receba o HTML com `data-storage-path` desde o primeiro tick.
- Verificar também que `DOMPurify` com `ADD_ATTR: ["data-storage-path"]` preserva o atributo (já está configurado, manter).
- Migração de dados não é necessária: imagens novas salvarão corretamente; demandas antigas com imagens já quebradas (`<img src="signed-expirado">` sem `data-storage-path`) permanecem perdidas — não há como recuperar a partir do HTML salvo. Apenas comunicar isso ao usuário no fim.

### D. (Opcional, se desejar) Fallback para imagens órfãs antigas

Para mitigar imagens já quebradas, adicionar handler `onError` nas `<img>` renderizadas pelo TipTap que tentam reextrair o path do `src` (formato `…/demand-attachments/<path>?token=`) e pedem nova signed URL. Isso recupera demandas onde o save aconteceu antes da expiração mas o `data-storage-path` ficou ausente.

---

### Arquivos afetados
- `src/components/demands/detail/CommentInput.tsx` — reescrever (mention plain, sem overlay)
- `src/components/demands/detail/DemandConversationsTab.tsx` — modo edit reutiliza `CommentInput`, conversão token↔plain
- `src/components/demands/RichTextEditor.tsx` — `insertContent` com atributo, opcionalmente `onError` recovery

### Detalhes técnicos
- Conversão token→plain: regex `/@\[([^\]]+)\]\([0-9a-f-]{36}\)/g` → `@$1` (label já é o handle/nome).
- Conversão plain→token no submit: para cada `@\w[\w.\-]*` no texto, lookup no map; se encontrado, substituir; se não, deixar cru (não vira mention, mas não quebra).
- `mentionedUserIds` continua sendo extraído via regex de tokens depois da conversão.
- Cache de `user_profiles` reaproveita `queryKey: ["user_profiles_mentions"]` (já existe).

Sem migrations. Sem alteração de schema. Sem alteração no formato armazenado em `demand_comments.content`.