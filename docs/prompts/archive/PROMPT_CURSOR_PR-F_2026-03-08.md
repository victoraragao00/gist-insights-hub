Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: feat/settings-priorities-tab
Prioridade: ALTA

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## PR-F: feat: Settings priorities tab + jobStatusBadge dark mode

### Problema

1. SettingsPage nao tem aba para gerenciar configuracao de prioridades (client_priority_config)
2. jobStatusBadge usa cores light-only (bg-yellow-50, bg-blue-50 etc) sem variante dark

### Tarefa 1 — Nova aba "Prioridades"

Adicionar 4a aba no TabsList existente (integrations, sync, uploads → + priorities).

Conteudo da aba:
- Tabela listando todos os clients com sua config de prioridade
- Colunas: Nome do cliente, Tier (badge), Weight (peso numerico), Ativo (switch)
- Dados: useQuery em client_priority_config JOIN clients (para nome)
- Edicao inline: o admin pode alterar tier e weight com useMutation
- Apenas admin pode editar (usar useUserRole do hook existente em src/hooks/useUserRole.ts)
- Viewer ve a tabela read-only

Hook sugerido (criar em src/hooks/useClientPriorityConfig.ts):
```tsx
export function useClientPriorityConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-priority-config", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_priority_config")
        .select("*, clients(name)")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}
```

### Tarefa 2 — jobStatusBadge dark mode

Atualizar a funcao jobStatusBadge (dentro de SettingsPage.tsx) para usar pares light/dark:

```
pending:   bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800
running:   bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800
completed: bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800
failed:    bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800
```

### Nao fazer
- Nao tocar em outras abas (integrations, sync, uploads)
- Nao alterar o layout geral da pagina
- Nao criar pagina nova — e uma aba dentro de SettingsPage

### CTO Checklist
- m1: zero `any` — tipar config rows
- m4: staleTime 5min (configs mudam raramente)
- m5: queryKey com user?.id
- m8: erros Supabase tratados
- m9: useMutation para edicao de tier/weight
- m11: zero imports nao usados

### Criterios de aceitacao
- Nova aba "Prioridades" visivel e funcional
- Admin pode alterar tier e weight inline
- Viewer ve tabela read-only
- jobStatusBadge com cores corretas em dark mode
- Zero regressao nas outras abas

### PR
- Titulo: `feat: Settings priorities tab + jobStatusBadge dark mode`
- Branch: `feat/settings-priorities-tab`
- Arquivos: SettingsPage.tsx, src/hooks/useClientPriorityConfig.ts (novo)
