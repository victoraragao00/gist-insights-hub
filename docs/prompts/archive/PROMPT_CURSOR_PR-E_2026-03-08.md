Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: fix/notfound-router-link
Prioridade: BAIXA

Leia CONTEXT.md antes de comecar.

## PR-E: fix: use React Router Link in NotFound page

### Problema

NotFound.tsx usa `<a href="/">` (HTML anchor) em vez de `<Link to="/">` do React Router.
Isso causa full page reload desnecessario.

### Tarefas

1. Substituir:
```tsx
<a href="/" className="text-primary underline hover:text-primary/90">
  Voltar para o inicio
</a>
```

Por:
```tsx
<Link to="/" className="text-primary underline hover:text-primary/90">
  Voltar para o inicio
</Link>
```

2. Import: `import { Link, useLocation } from "react-router-dom";`
   (useLocation ja e importado, apenas adicionar Link ao import existente)

### Nao fazer
- Nao alterar estilos
- Nao alterar o useEffect de log

### CTO Checklist
- m11: zero imports nao usados

### Criterios de aceitacao
- Link navega sem full reload
- Visual identico

### PR
- Titulo: `fix: use React Router Link in NotFound page`
- Branch: `fix/notfound-router-link`
- Arquivos: NotFound.tsx
