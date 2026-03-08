# PR: feat: Audits page with real alerts from audit_alerts_summary

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/audits-real-ui`
Prioridade: ALTA

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## Problema

Audits.tsx (29 linhas) e um placeholder "Em desenvolvimento". O backend agora entrega `audit_alerts_summary(p_user_id)` com alertas reais. Precisamos de UI real.

## Frontend Contract (do Lovable S3)

```
DB Function: audit_alerts_summary(p_user_id uuid)

Return type:
  total_alerts_30d: number
  unread_count: number
  alerts: {
    id: string
    client_name: string
    metric: string
    metric_value: number
    message: string
    read: boolean
    created_at: string
  }[]

queryKey: ["audit-alerts-summary", user?.id]
staleTime: 30_000
enabled: !!user?.id
```

## Tarefa 1 — Hook useAuditAlerts

Criar `src/hooks/useAuditAlerts.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface AuditAlert {
  id: string;
  client_name: string;
  metric: string;
  metric_value: number;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AuditAlertsSummary {
  total_alerts_30d: number;
  unread_count: number;
  alerts: AuditAlert[];
}

export function useAuditAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["audit-alerts-summary", user?.id],
    queryFn: async (): Promise<AuditAlertsSummary | null> => {
      const { data, error } = await supabase.rpc("audit_alerts_summary", {
        p_user_id: user!.id,
      });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const row = data[0] as Record<string, unknown>;
      return {
        total_alerts_30d: Number(row.total_alerts_30d ?? 0),
        unread_count: Number(row.unread_count ?? 0),
        alerts: (row.alerts ?? []) as AuditAlert[],
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
```

## Tarefa 2 — Reescrever Audits.tsx

Substituir o placeholder inteiro. Novo layout:

### KPI cards (topo)
Grid 2 colunas (mobile) / 3 colunas (desktop):
- Total de alertas (30d) — icone ShieldAlert
- Nao lidos — icone Bell
- (opcional) badge com contagem de nao lidos se > 0

Usar o componente `KPICard` existente em `@/components/KPICard`.

### Lista de alertas
- Se `alerts.length === 0`: mostrar empty state com icone ShieldCheck e texto "Nenhum alerta nos ultimos 30 dias"
- Se tem alertas: tabela (Table) com colunas:
  - Cliente (client_name)
  - Metrica (metric) — traduzir: `score_prioridade` → "Score", `tom_critico_pct` → "% Critico", `volume_periodo` → "Volume"
  - Valor (metric_value) — formatar com 1 casa decimal
  - Mensagem (message) — truncar em 80 chars com tooltip
  - Data (created_at) — formatDistanceToNow com ptBR
  - Status — badge: nao lido = `bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400`, lido = `bg-muted text-muted-foreground`

### Loading state
Skeletons com `animate-shimmer` (mesmo padrao de ClientsPage).

### Error state
Alert com botao de refetch (mesmo padrao de ClientsPage PR-A1).

## Tarefa 3 — Animacoes

- Cards: `animate-fade-in-up` com stagger 50ms (maximo 10 itens)
- Linhas da tabela: fade-in sutil

## Nao fazer

- Nao implementar marcar como lido (futuro, requer mutation)
- Nao implementar filtros (futuro)
- Nao alterar DashboardLayout
- Nao alterar logica de backend

## CTO Checklist

- m1: zero `any` — tipar AuditAlert e AuditAlertsSummary
- m4: staleTime 30s (alertas sao dinamicos)
- m5: queryKey com user?.id
- m8: erros Supabase tratados (throw error)
- m11: zero imports nao usados (remover ShieldAlert do placeholder se nao reusar)

## Criterios de aceitacao

- Pagina Auditorias mostra KPIs reais e lista de alertas
- Empty state quando sem alertas
- Loading com shimmer skeletons
- Error state com refetch
- Dark mode correto em todos os badges
- Zero regressao nas outras paginas

## PR

- Titulo: `feat: Audits page with real alerts from audit_alerts_summary`
- Branch: `feat/audits-real-ui`
- Arquivos: Audits.tsx (reescrito), src/hooks/useAuditAlerts.ts (novo)
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
