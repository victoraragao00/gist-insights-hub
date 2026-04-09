

## Plan: Clarificar SLA nas Configurações de Colunas

### Contexto

O badge "Início" (`triggers_started_at`) nas colunas indica onde o cronômetro do SLA para. O usuário quer que fique explícito que o SLA começa na criação do ticket e encerra quando entra na coluna marcada com "Início".

### Alterações em `src/components/demands/ColumnSettingsTab.tsx`

**1. Adicionar explicação de SLA na `CardDescription` (linha 203-205)**

Trocar a descrição atual por um texto que inclua a regra de SLA:

```
Arraste para reordenar, clique no nome para editar.
O SLA de primeira resposta inicia quando o ticket é criado e encerra quando ele entra na coluna marcada com "Início SLA".
```

**2. Renomear badges para clareza (linhas 99-108)**

- Badge `triggers_started_at`: trocar label de "Início" para "Início SLA" (com tooltip explicando: "O SLA de primeira resposta encerra quando o ticket entra nesta coluna")
- Badge `triggers_finished_at`: manter "Fim"

Envolver cada badge com `Tooltip` para que ao passar o mouse o usuário veja a explicação completa.

**3. Adicionar callout informativo abaixo da lista de colunas**

Um `Alert` discreto com ícone `Clock` explicando:

> **Como funciona o SLA:** O cronômetro de primeira resposta começa automaticamente quando o ticket é criado. Ele para quando o ticket é movido para a coluna marcada como "Início SLA" (ex: A Fazer). Configure os limites de tempo na aba SLA.

**4. Imports adicionais**

- `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` de `@/components/ui/tooltip`
- `Alert, AlertDescription` de `@/components/ui/alert`
- `Clock` de `lucide-react`

### Files changed

| Action | File |
|--------|------|
| Edit | `src/components/demands/ColumnSettingsTab.tsx` |

### No changes to
- Migrations, RLS, hooks, edge functions, `src/integrations/supabase/*`, `.env`

