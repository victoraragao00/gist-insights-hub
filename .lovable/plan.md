

## Plan: Mostrar nome do contato cliente na coluna "Conversa"

### Alterações em `src/pages/ClientDetailPage.tsx`

**1. Adicionar `contact_name` ao tipo do grupo (linha 460-466)**

Adicionar `contact_name: string | null` ao tipo do objeto de agrupamento.

**2. Capturar `contact_name` no loop (linhas 468-489)**

Ao criar o grupo, inicializar `contact_name` com `sender_raw` se `sender_side === "client"`, senão `null`. Nas iterações seguintes, preencher se ainda `null`.

**3. Substituir ID truncado pelo nome (linha 887-889)**

Trocar `conv.conversation_id.slice(0, 12) + "…"` por `conv.contact_name ?? conv.conversation_id.slice(0, 12) + "…"`, remover `font-mono`.

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/ClientDetailPage.tsx` |

### No changes to
- Queries, hooks, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

