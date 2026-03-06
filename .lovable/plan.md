

## Corrigir header mockado do ClientDetailPage

### Mudanças em `src/pages/ClientDetailPage.tsx`

**1. Badge "Ativo" → dinâmico** (linha 436)
- Usar `client.active` para alternar entre "Ativo" (verde) e "Inativo" (cinza)

**2. Label "Atualizado" → "Última msg"** (linha 442)
- Renomear para deixar claro que é a data da última mensagem, não sync

**3. "Gist sync: automático (6h)" → "Último acesso Gist: há Xh"** (linhas 443-446)
- Substituir texto hardcoded por `meta.last_seen_at` com `formatRelativeTime`
- Label: "Último acesso Gist" (consistente com o KPI card da aba Visão Geral)
- Se `last_seen_at` não existir, mostrar "Último acesso Gist: —"

### Resultado visual esperado
```
slug: nkstore-com-br · 2 canais · Última msg Hoje, 15:11 · Último acesso Gist: há 3h
```

~10 linhas alteradas, nenhum arquivo novo, nenhuma query adicional.

