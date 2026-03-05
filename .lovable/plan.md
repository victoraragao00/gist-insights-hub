

## InteractionsPage — Rebuild completo

### Escopo

Reescrever `src/pages/InteractionsPage.tsx` de painel de debug para feed de conversas com filtros, scroll infinito e painel lateral de detalhe.

### Arquivos

**Modificar:** `src/pages/InteractionsPage.tsx` (rebuild completo)

**Nao tocar:** Edge functions, ClientContext, AppSidebar, outras paginas.

### Estrutura de componentes

Tudo dentro de `InteractionsPage.tsx` (componentes inline ou extraidos em sections dentro do mesmo arquivo para manter simplicidade):

```text
InteractionsPage
├── Header (titulo + subtitle com selectedClient.name)
├── FilterBar (linha de filtros + busca + limpar)
├── ResultCount ("Exibindo X de Y interacoes")
├── Timeline (lista com agrupamento por data + infinite scroll)
│   ├── DateSeparator
│   └── InteractionRow (icone canal, badges, conteudo truncado)
└── DetailSheet (painel lateral direito, 420px)
    ├── Header (nome, lado, canal, data, botao X)
    ├── Conteudo completo + anexos
    ├── Classificacao IA (tom, tema, sentimento, modelo)
    ├── Botao Reclassificar (toast "Em breve")
    └── Raw payload (colapsavel)
```

### Filtros

- Estado gerenciado via `useSearchParams` para persistencia em URL
- Filtros: `canal`, `lado`, `tom`, `tema`, `periodo`, `busca`
- Componentes: `Select` (shadcn) para dropdowns, `Input` para busca com debounce 300ms, `Popover + Calendar` para date range
- Botao "Limpar filtros" visivel apenas quando algum filtro ativo
- Periodos pre-definidos: 7d, 30d, 90d, personalizado

### Query

- Supabase query com `.select()` incluindo join em `participants` via `sender_participant_id`
- Filtros aplicados condicionalmente
- `count: 'exact'` em query separada (head: true) para total
- `PAGE_SIZE = 50`, paginacao via `.range()`
- `useInfiniteQuery` do TanStack para scroll infinito com `getNextPageParam`

### Timeline

- Agrupamento por data: iterar e inserir `DateSeparator` quando `occurred_at` muda de dia
- Cada row mostra: icone canal (emoji), badge lado (azul/ambar), nome remetente, hora, badge tom (colorido), badge tema (cinza)
- Conteudo truncado a 200 chars com "ver mais" inline
- Se `classified_at === null`: badge cinza "Nao classificado"
- Hover: `hover:bg-violet-50`, cursor pointer
- Loading: 10 Skeleton items
- Empty state com icone + "Nenhuma interacao encontrada" + botao limpar filtros
- IntersectionObserver no ultimo item para trigger de `fetchNextPage`

### Painel lateral

- Usar `Sheet` (shadcn, side="right") em desktop overlay
- Para desktop >1280px: usar layout flex com timeline shrinkando e sheet fixo a direita (420px)
- Secoes: conteudo completo, anexos, classificacao IA (tom/tema/sentimento/is_out_of_scope/modelo/data), botao "Reclassificar" (toast), raw payload em `<details>`
- Sentimento: barra visual de -1 a +1 usando `Progress` com offset

### Mapeamento visual

| Canal | Icone |
|-------|-------|
| gist | MessageSquare |
| whatsapp | Smartphone |
| email | Mail |
| discord | Hash |
| transcription_* | Mic |
| manual | PenLine |

| Tom | Cor |
|-----|-----|
| ok | green |
| atencao | yellow |
| alerta | orange |
| critico | red |

| Lado | Cor |
|------|-----|
| customer | amber |
| agent/umode | blue |
| unknown | gray |

### Enums disponiveis (do types.ts)

- `channel_type`: gist, discord, whatsapp, email, transcription_gemini, transcription_tactiq, manual
- `tone_severity`: ok, atencao, alerta, critico
- `interaction_type`: text, audio, image, file, system

### Performance

- Debounce 300ms no input de busca (useCallback + setTimeout)
- Selects disparam query imediato (resetam page)
- useInfiniteQuery com staleTime adequado
- Memo nos componentes de row para evitar re-render

