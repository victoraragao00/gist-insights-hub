# Imagens inline na descrição das demandas (CX e TECH)

## Objetivo
Permitir que o time cole/arraste/anexe imagens **dentro do corpo** dos campos "Descrição", "Resultado esperado", "Notas internas" e "Resolução" da demanda — exatamente como na referência (texto + imagem intercalada). Vale para os boards CX Hub e TECH (mesmo componente).

## Abordagem
Trocar os `<Textarea>` desses 4 campos por um **editor rich-text leve baseado em Tiptap** (já é o padrão de fato em apps com paste/drag de imagem) salvando o conteúdo como **HTML sanitizado** nas mesmas colunas (`description`, `expected_result`, `notes`, `resolution`).

Imagens viram anexos no bucket privado `demand-attachments` (já existente) e são embutidas como `<img data-storage-path="demands/<id>/...">`. Na renderização (e no editor), um pequeno hook resolve o `data-storage-path` para uma **signed URL** (1h) e injeta no `src`. Isso evita o problema de URLs expirando dentro do conteúdo persistido.

Compatibilidade: conteúdo antigo (texto puro) é renderizado como `<p>` normal — Tiptap aceita texto direto. Sem migração de dados.

## Escopo de UI
- `src/components/demands/detail/DemandContentTab.tsx` — substituir 4 Textareas pelo novo `<RichTextEditor>`. Manter auto-save no blur (debounce 500ms ao invés de blur puro, porque o editor não tem evento blur 1:1 — usar `onUpdate` debounced).
- `src/components/demands/RichTextEditor.tsx` (novo) — wrapper Tiptap com:
  - StarterKit (parágrafo, bold, italic, listas, headings 2-3, link)
  - Extension `Image` customizada com `data-storage-path`
  - Toolbar mínima (negrito, itálico, lista, link, imagem)
  - Handler `paste` e `drop` que detecta `image/*` → chama `uploadInlineImage()` → insere `<img data-storage-path=...>` no cursor
  - Botão "Imagem" na toolbar abre file picker
- `src/components/demands/RichTextView.tsx` (novo) — renderiza HTML salvo (read-only) resolvendo as signed URLs. Usado em qualquer lugar futuro que precise exibir a descrição sem editar (ex: página pública, project tab).

## Escopo de hooks
- `src/hooks/useDemandAttachments.ts` — adicionar:
  - `useUploadInlineImage(demandId)` → upload pra `demands/<id>/inline/<uuid>.<ext>`, **sem** criar registro em `demand_attachments` (inline não polui a lista de anexos). Retorna `{ storagePath }`.
  - `useResolveStoragePaths(paths: string[])` → retorna `Record<path, signedUrl>` com `staleTime: 30min`, queryKey inclui paths sorted.

## Escopo de dependências
- `bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link`
- `bun add dompurify @types/dompurify` (sanitizar HTML antes de salvar)

## Escopo backend
Nada. As colunas `description`/`expected_result`/`notes`/`resolution` já são `text` e aceitam HTML. Bucket `demand-attachments` já existe com RLS. Sem migration.

## Detalhes técnicos
1. **Persistência:** o editor emite HTML via `editor.getHTML()`. Antes de salvar, `DOMPurify.sanitize(html, { ALLOWED_ATTR: [..., 'data-storage-path'], ALLOWED_TAGS: [..., 'img'] })`.
2. **Resolução de imagens:** ao montar `RichTextEditor` com `content`, percorrer o DOM, coletar todos `data-storage-path`, chamar `useResolveStoragePaths`, e atribuir `img.src = map[path]`. Mesmo no `RichTextView`.
3. **Upload inline:**
   - Paste: `editor.view.props.handlePaste` intercepta `event.clipboardData.files` com `image/*`.
   - Drop: `handleDrop` análogo.
   - Botão toolbar: input file `accept="image/*"`.
   - Fluxo: gera `uuid`, faz `supabase.storage.from('demand-attachments').upload(path, file)`, insere node Image com `data-storage-path=path` e `src=` (signed URL otimista de 1h obtida no momento do upload).
4. **Auto-save:** `onUpdate` debounce 600ms; só salva se `editor.getHTML() !== lastSaved`. Mostra indicador "salvando…" sutil ao lado do label.
5. **Atalhos:** Ctrl/Cmd+B, I, K (link) — nativos do Tiptap.

## Fora de escopo
- Comentários da demanda (continua plain text por enquanto — pode ser feito num segundo passo reusando `RichTextEditor`).
- Mensagens do Gist (renderização própria).
- Migração de descrições antigas para HTML — não necessário.

## Verificação
1. Colar print (Ctrl+V) no campo Descrição → imagem aparece inline → recarregar a página → imagem continua aparecendo.
2. Arrastar arquivo de imagem para o campo → idem.
3. Botão "Imagem" da toolbar → file picker → upload → inserção no cursor.
4. Mover demanda entre boards CX/TECH → conteúdo (incl. imagens) preservado.
5. Demanda antiga (sem HTML) abre normalmente como texto.
6. Abrir 1h depois → signed URLs renovadas automaticamente (refetch após 30min).
7. Editar negrito/lista/link funciona em todos os 4 campos.
