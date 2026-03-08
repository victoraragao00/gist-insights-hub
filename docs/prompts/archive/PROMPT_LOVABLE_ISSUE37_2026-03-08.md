Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Issue: https://github.com/HyTrackWater/gist-insights-hub/issues/37

Leia o CONTEXT.md do repositorio antes de comecar.

Implemente a Issue #37: criar DB function `global_stats_30d(p_user_id uuid)` que retorna KPIs agregados para o Dashboard.

Campos de retorno:
- total_interactions_30d (int)
- pct_critico (float)
- pct_alerta (float)
- total_clients_monitored (int)
- last_calculated_at (timestamptz)
- monthly_tone_evolution (jsonb) — array de {mes, ok, atencao, alerta, critico}, ultimos 6 meses
- top_themes (jsonb) — array de {theme, count}, top 5

Regras:
- Filtrar apenas interacoes com classified_at IS NOT NULL
- Filtrar por user_accessible_client_ids(p_user_id) para respeitar RLS
- Janela: 30 dias para totais, 6 meses para evolucao
- Performance target: < 500ms para ~21k interacoes
- Retornar zeros/arrays vazios se nao houver dados

Entregaveis:
1. Migration SQL com a function
2. Regenerar types.ts

IMPORTANTE — Frontend Contract:
Inclua no PR uma secao "Frontend Contract" com:
- Return type exato (campos e tipos TypeScript)
- queryKey sugerido: ["global-stats", user?.id]
- staleTime sugerido: 5 * 60_000
- enabled: !!user?.id
- Edge cases documentados (zeros quando sem dados, array vazio se < 1 mes, top_themes ate 5 itens)

CTO Checklist:
- m1: Zero `any`
- m8: Erros tratados (retornar defaults se sem dados)
- m11: Zero codigo nao usado
