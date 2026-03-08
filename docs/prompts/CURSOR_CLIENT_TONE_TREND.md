# PR: feat: tone trend 7d chart in ClientDetailPage

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/client-tone-trend-chart`
Prioridade: MEDIA

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## Problema

ClientDetailPage mostra distribuicao de tom como barra compacta (percentual estatico). O backend agora entrega `client_tone_trend_7d(p_user_id, p_client_id)` com evolucao diaria nos ultimos 7 dias. Precisamos de um grafico de tendencia.

## Frontend Contract (do Lovable S5)

```
DB Function: client_tone_trend_7d(p_user_id uuid, p_client_id uuid)

Return type:
  day: string (date)
  ok: number
  atencao: number
  alerta: number
  critico: number

queryKey: ["client-tone-trend", user?.id, clientId]
staleTime: 5 * 60_000
enabled: !!user?.id && !!clientId
```

## Tarefa 1 — Hook useClientToneTrend

Criar `src/hooks/useClientToneTrend.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface ToneTrendDay {
  day: string;
  ok: number;
  atencao: number;
  alerta: number;
  critico: number;
}

export function useClientToneTrend(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-tone-trend", user?.id, clientId],
    queryFn: async (): Promise<ToneTrendDay[]> => {
      const { data, error } = await supabase.rpc("client_tone_trend_7d", {
        p_user_id: user!.id,
        p_client_id: clientId!,
      });
      if (error) throw error;
      return (data ?? []) as ToneTrendDay[];
    },
    enabled: !!user?.id && !!clientId,
    staleTime: 5 * 60_000,
  });
}
```

## Tarefa 2 — Grafico de tendencia em ClientDetailPage

Adicionar um novo Card abaixo do grafico de volume existente ("Volume de interacoes ultimos 14 dias"):

### Card: "Evolucao de tom (7 dias)"

```tsx
<Card className="border-border">
  <CardHeader className="pb-2">
    <CardTitle className="text-base font-semibold">Evolução de tom (7 dias)</CardTitle>
  </CardHeader>
  <CardContent>
    {/* stacked BarChart com 4 barras empilhadas */}
  </CardContent>
</Card>
```

### Grafico
- Usar `recharts` (ja importado no arquivo): stacked BarChart
- Mesmo padrao do grafico de evolucao de tom no Index.tsx (PR-H2)
- Barras empilhadas: ok, atencao, alerta, critico
- Cores conforme Design System:
  - ok: `hsl(160, 84%, 39%)` (emerald)
  - atencao: `hsl(48, 96%, 53%)` (yellow)
  - alerta: `hsl(25, 95%, 53%)` (orange)
  - critico: `hsl(0, 84%, 60%)` (red)
- XAxis: `day` formatado como DD/MM (ex: "08/03")
- YAxis: contagem
- Tooltip
- Altura: h-48
- Usar `ChartContainer` wrapper (importar de `@/components/ui/chart`)

### Loading state
- Skeleton h-48 com `animate-shimmer` enquanto carrega

### Empty state
- Se todos os 7 dias tiverem zeros: texto "Sem interacoes classificadas nos ultimos 7 dias"

## Tarefa 3 — Formatacao do eixo X

O backend retorna `day` como date string (ex: "2026-03-08"). Formatar para exibicao:

```tsx
const chartData = toneTrend?.map((d) => ({
  ...d,
  day: new Date(d.day + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
})) ?? [];
```

## Nao fazer

- Nao remover a barra compacta de distribuicao de tom existente (ela mostra % total, o novo grafico mostra tendencia diaria — sao complementares)
- Nao alterar o grafico de volume (14 dias)
- Nao alterar logica de backend

## CTO Checklist

- m1: zero `any` — tipar ToneTrendDay
- m4: staleTime 5min (dados recalculam a cada 2h)
- m5: queryKey com user?.id e clientId
- m8: erros Supabase tratados
- m11: zero imports nao usados

## Criterios de aceitacao

- Grafico stacked bar com 7 dias de evolucao de tom
- Cores conforme Design System (emerald, yellow, orange, red)
- Loading com skeleton shimmer
- Empty state se sem dados
- Barra compacta existente preservada
- Dark mode correto
- Zero regressao

## PR

- Titulo: `feat: tone trend 7d chart in ClientDetailPage`
- Branch: `feat/client-tone-trend-chart`
- Arquivos: ClientDetailPage.tsx (modificado), src/hooks/useClientToneTrend.ts (novo)
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
