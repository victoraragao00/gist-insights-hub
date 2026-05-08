## Editor rico com imagens no diálogo de criação de demanda

Hoje o `RichTextEditor` (com colar/arrastar imagens) só está disponível na aba de detalhes da demanda já criada (`DemandContentTab.tsx`). No diálogo "Nova Demanda" (`CreateDemandDialog.tsx`), os campos **Descrição**, **Resultado Esperado** e **Notas** ainda usam `<Textarea>`/`<Input>` simples — sem suporte a imagens inline.

### O que será feito

Substituir os campos de texto livre do `CreateDemandDialog` pelo mesmo `RichTextEditor` usado na edição, de modo que o usuário possa colar/arrastar imagens já durante a criação.

### Desafio técnico (upload antes do ID existir)

O upload inline atual usa `demandId` no caminho do storage (`demands/<id>/inline/...`). Como a demanda ainda não existe na criação, vamos usar um **ID temporário** (UUID gerado no client via `crypto.randomUUID()`) como pasta de staging:

- Caminho de upload: `demands/_drafts/<draftId>/inline/<uuid>.<ext>`
- Após `createMutation` retornar com sucesso e o novo `demand.id`, executar um passo de **promoção**: mover (copiar + deletar) os arquivos da pasta `_drafts/<draftId>/` para `demands/<newId>/inline/` e atualizar os atributos `data-storage-path` no HTML salvo (replace simples no string) antes ou logo depois do insert.

Alternativa mais simples (preferida): **manter o caminho `_drafts/<draftId>` no HTML salvo**. As imagens continuam acessíveis via signed URL (mesmo bucket, mesma RLS de leitura por usuário autenticado). Sem job de movimentação. Trade-off: arquivos órfãos se o usuário cancelar — limpamos no `onOpenChange(false)` chamando `storage.remove()` do prefixo do draft.

Vamos com a alternativa simples (drafts permanentes + cleanup ao cancelar).

### Mudanças

**`src/hooks/useDemandAttachments.ts`**
- Generalizar `useUploadInlineImage` para aceitar um `pathPrefix` (ex: `demands/<id>/inline` ou `demands/_drafts/<draftId>/inline`) em vez de receber só `demandId`.
- Adicionar helper `useCleanupDraftInlineImages(draftId)` que lista e remove arquivos do prefixo de draft.

**`src/components/demands/RichTextEditor.tsx`**
- Aceitar prop opcional `uploadPathPrefix?: string` (default mantém comportamento atual baseado em `demandId`).
- Quando recebido, usa esse prefixo no upload em vez de `demands/<demandId>/inline`.

**`src/components/demands/CreateDemandDialog.tsx`**
- Gerar `draftId` (UUID) com `useRef` na primeira abertura do diálogo.
- Substituir os 3 `<Textarea>`/`<Input>` (Descrição, Resultado Esperado, Notas) por `<RichTextEditor uploadPathPrefix={`demands/_drafts/${draftId}/inline`} />`.
- No `resetForm()` e ao fechar sem criar (`onOpenChange(false)` antes de ter `createdDemandId`), chamar cleanup das imagens do draft.
- Após sucesso da criação, **não** limpar — o HTML salvo já referencia esses paths e continuará renderizando via signed URL.

### Verificação
- Abrir "Nova Demanda" → colar imagem na Descrição → criar → abrir detalhes → imagem aparece.
- Abrir "Nova Demanda" → colar imagem → cancelar → arquivos do draft são removidos do storage.
- Campos vazios continuam salvando como `null`/string vazia normalmente.
