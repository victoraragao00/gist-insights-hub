# PR: feat: global search page with search_interactions

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/search-interactions-page`
Prioridade: MEDIA

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## Problema

Nao existe busca global de interacoes no app. O backend agora entrega `search_interactions(p_user_id, p_query, ...)` com full-text search e paginacao.

## Frontend Contract (do Lovable S4)

```
DB Function: search_interactions(p_user_id, p_query, p_client_id?, p_tone?, p_limit?, p_offset?)

Return type:
  id: string
  client_name: string
  sender_raw: string
  sender_side: string
  body: string
  tone: string
  theme: string
  occurred_at: string
  total_count: number

queryKey: ["search-interactions", user?.id, query, clientId, tone, page]
staleTime: 30_000
enabled: !!user?.id && query.length >= 3
```

## Tarefa 1 — Hook useSearchInteractions

Criar `src/hooks/useSearchInteractions.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface SearchResult {
  id: string;
  client_name: string;
  sender_raw: string;
  sender_side: string;
  body: string;
  tone: string;
  theme: string;
  occurred_at: string;
  total_count: number;
}

interface SearchParams {
  query: string;
  clientId?: string;
  tone?: string;
  page?: number;
  limit?: number;
}

export function useSearchInteractions(params: SearchParams) {
  const { user } = useAuth();
  const { query, clientId, tone, page = 0, limit = 20 } = params;

  return useQuery({
    queryKey: ["search-interactions", user?.id, query, clientId, tone, page],
    queryFn: async (): Promise<SearchResult[]> => {
      const { data, error } = await supabase.rpc("search_interactions", {
        p_user_id: user!.id,
        p_query: query,
        p_client_id: clientId || null,
        p_tone: tone || null,
        p_limit: limit,
        p_offset: page * limit,
      });
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
    enabled: !!user?.id && query.length >= 3,
    staleTime: 30_000,
  });
}
```

## Tarefa 2 — Criar pagina SearchPage.tsx

Criar `src/pages/SearchPage.tsx`:

### Layout

```
[Titulo "Busca de Interacoes"]
[Input de busca com icone Search] [Select cliente (opcional)] [Select tom (opcional)]
[Tabela de resultados]
[Paginacao]
```

### Barra de busca
- Input com `debounce` de 300ms (usar setTimeout/clearTimeout, nao instalar lib)
- Busca dispara quando `query.length >= 3`
- Placeholder: "Buscar em todas as interacoes..."

### Filtros opcionais
- Select de cliente: carregar lista de clientes do usuario (useQuery em `clients` com `user_accessible_client_ids`)
- Select de tom: opcoes fixas (Todos, Ok, Atencao, Alerta, Critico)

### Tabela de resultados
Colunas:
- Cliente (client_name)
- Remetente (sender_raw) — com badge sender_side: "customer" = `bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400`, "agent" = `bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400`
- Corpo (body) — truncar em 100 chars
- Tom — badge com cores do TONE_CONFIG (Design System 1.1)
- Tema (theme)
- Data (occurred_at) — formatDistanceToNow com ptBR

### Paginacao
- Usar `total_count` da primeira row para calcular total de paginas
- Botoes Anterior/Proximo
- Mostrar "X de Y resultados"
- PAGE_SIZE = 20

### Estados
- Inicial (sem busca): texto "Digite ao menos 3 caracteres para buscar"
- Loading: Skeletons com `animate-shimmer`
- Vazio: "Nenhum resultado encontrado para [query]"
- Erro: Alert com refetch

## Tarefa 3 — Registrar rota

Adicionar rota em `App.tsx` (ou onde estiverem as rotas):
- Path: `/search`
- Component: `SearchPage`
- Dentro do DashboardLayout (rota protegida)

Adicionar link na sidebar do DashboardLayout:
- Icone: `Search` do lucide-react
- Label: "Busca"
- Posicao: apos "Clientes"

## Nao fazer

- Nao instalar lodash/debounce — usar setTimeout nativo
- Nao alterar outras paginas
- Nao alterar backend

## CTO Checklist

- m1: zero `any` — tipar SearchResult
- m4: staleTime 30s
- m5: queryKey com todos os parametros (query, clientId, tone, page)
- m8: erros Supabase tratados
- m9: N/A (read-only)
- m11: zero imports nao usados
- m12: paginacao real com offset (total_count do backend)

## Criterios de aceitacao

- Busca funcional com debounce 300ms
- Filtros por cliente e tom
- Paginacao real com total de resultados
- Todos os estados (inicial, loading, vazio, erro)
- Dark mode correto
- Rota /search registrada e acessivel pela sidebar
- Zero regressao

## PR

- Titulo: `feat: global search page with search_interactions`
- Branch: `feat/search-interactions-page`
- Arquivos: SearchPage.tsx (novo), useSearchInteractions.ts (novo), App.tsx (rota), DashboardLayout.tsx (sidebar link)
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
