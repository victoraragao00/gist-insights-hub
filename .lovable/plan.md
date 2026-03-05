

## Mover InteractionsFeed para ClientDetailPage

### Arquivos

**Criar:** `src/components/InteractionsFeed.tsx`
- Extrair toda a lógica de `InteractionsPage.tsx` (linhas 1-617): constants, types, helpers (`stripHtml`, `sanitizeHtml`, `isImageUrl`, etc.), sub-components (`DateSeparator`, `InteractionRow`, `LoadingSkeleton`, `DetailPanel`), filter bar, infinite scroll, detail panel
- Prop: `clientId: string`
- Remover dependência de `useClient()` — recebe `clientId` diretamente
- Default de período: `"30"` (últimos 30 dias) em vez de vazio
- Remover opção "90 dias" e "Todo período" — máximo permitido = 30 dias
- `PERIOD_OPTIONS`: `[7d, 14d, 30d, custom]` — custom limitado a 30 dias
- Remover header (título "Interações" e subtitle) — fica por conta do contexto pai (tab)
- Filtros continuam via `useSearchParams` para persistência em URL

**Modificar:** `src/pages/ClientDetailPage.tsx`
- Importar `InteractionsFeed` 
- Adicionar tab "Interações" como 2a posição (entre "Visão Geral" e "Participantes")
- Conteúdo da tab: `<InteractionsFeed clientId={client.id} />`
- ~5 linhas de mudança

**Modificar:** `src/pages/InteractionsPage.tsx`
- Substituir conteúdo por redirect: `<Navigate to="/clients" replace />`

**Modificar:** `src/App.tsx`
- Remover rota `/interactions`
- Remover import de `InteractionsPage`

**Modificar:** `src/components/AppSidebar.tsx`
- Remover item "Interações" do array `modules`

### Estrutura do InteractionsFeed

```text
InteractionsFeed ({ clientId })
├── FilterBar (canal, lado, tom, tema, período [default 30d, max 30d], busca)
├── ResultCount
├── Timeline (infinite scroll via useInfiniteQuery + IntersectionObserver)
│   ├── DateSeparator
│   └── InteractionRow (memo)
└── DetailPanel (desktop: fixed right 420px, mobile: Sheet)
```

### Mudança de período
- Default: `periodo=30` (últimos 30 dias)
- Opções: 7d, 14d, 30d, Personalizado
- Custom: calendário limitado a `fromDate = subDays(new Date(), 30)`

