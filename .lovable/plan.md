

# Dashboard com KPIs do Gist — Dados em Tempo Real

## O que será construído

Transformar a página **Dashboard** (Index) em um painel com KPIs reais puxados live da API do Gist via a edge function `gist-proxy` já existente.

## KPIs a exibir

| KPI | Fonte (endpoint) | Cálculo |
|-----|-------------------|---------|
| Total de Contatos | `contacts` (campo `pages.total_count`) | Número direto |
| Conversas Abertas | `conversations` com param `state=open` | `pages.total_count` |
| Conversas Fechadas | `conversations` com param `state=closed` | `pages.total_count` |
| Total de Tags | `tags` | Length do array retornado |
| Teammates Online | `teammates` | Filtrar `away_mode_enabled === false` |
| Segmentos Ativos | `segments` | Length do array |

## Implementação

### 1. Hook `useGistKPIs`
- Novo arquivo `src/hooks/useGistKPIs.ts`
- Usa `supabase.functions.invoke('gist-proxy')` para buscar cada endpoint em paralelo
- Retorna os KPIs calculados, estado de loading e erros
- Usa `react-query` para cache e refetch automático (a cada 5 min)

### 2. Atualizar página Dashboard (`src/pages/Index.tsx`)
- Substituir os cards estáticos (zeros) por cards dinâmicos com dados reais
- Mostrar loading skeleton enquanto carrega
- Exibir os 6 KPIs em grid responsivo
- Indicar status de conexão (se o Gist está respondendo)

### 3. Componente `KPICard`
- Card reutilizável com: título, valor, ícone, cor, variação opcional
- Skeleton state para loading

### Arquivos alterados
- `src/hooks/useGistKPIs.ts` (novo)
- `src/pages/Index.tsx` (atualizado)
- Possível: `src/components/KPICard.tsx` (novo)

Nenhuma alteração no banco de dados ou edge function necessária — tudo usa a infra já existente.

