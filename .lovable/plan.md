

## Melhorias para conteúdo HTML e anexos

### Problemas identificados nos prints

1. **HTML cru no conteúdo** — mensagens do Gist contêm `<br>`, `<p>`, `<a>` etc. que são exibidas como texto literal
2. **Anexos como texto** — URLs de imagens do Gist CDN mostradas como strings em vez de thumbnails/links clicáveis

### Plano de implementação

#### `src/pages/InteractionsPage.tsx`

**1. Sanitizar e renderizar HTML no conteúdo**

Criar helper `renderContent` que:
- Converte `<br>` e `<br/>` em `\n`
- Remove tags HTML perigosas (`<script>`, `<style>`, `<iframe>`)
- Permite tags seguras: `<a>`, `<b>`, `<strong>`, `<em>`, `<i>`, `<p>`, `<ul>`, `<ol>`, `<li>`
- Usa `dangerouslySetInnerHTML` com o HTML sanitizado para o painel de detalhe (conteúdo completo)
- Na timeline (row truncado): strip all HTML → texto puro → truncar a 200 chars

```typescript
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const sanitizeHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
```

- `InteractionRow`: usa `truncate(stripHtml(content), 200)` — sem HTML
- `DetailPanel`: usa `<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />` com classes de prose

**2. Renderizar anexos como thumbnails/links**

Alterar a seção de anexos no `DetailPanel` para:
- Detectar se a URL é imagem (`.jpg`, `.png`, `.gif`, `.webp`, ou contém `image` no path)
- Se imagem: renderizar `<img>` com thumbnail clicável (abre em nova aba)
- Se outro arquivo: link clicável com ícone de download
- Extrair nome do arquivo da URL se `a.name` não existir

Na `InteractionRow`: se há anexos, mostrar badge pequeno "📎 N anexos" ao lado do conteúdo

**3. Estilos para HTML renderizado**

Adicionar classes Tailwind prose no container de conteúdo do DetailPanel:
```
className="text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none"
```

Isso garante que `<a>`, `<p>`, `<ul>` etc. renderizem com estilo adequado.

### Arquivo modificado
- `src/pages/InteractionsPage.tsx`

### Sem alterações
- Edge functions, ClientContext, AppSidebar, outras páginas

