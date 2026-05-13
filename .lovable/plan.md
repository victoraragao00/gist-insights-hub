## Datas planejadas e reais nas demandas

Hoje a demanda só tem `started_at` e `finished_at` (timestamps automáticos disparados quando o card entra numa coluna com `triggers_started_at` / `triggers_finished_at`). Não existe data planejada.

### 1. Banco (migration)

Adicionar 2 colunas em `demands` (datas planejadas, sem hora):
- `planned_start_date date NULL`
- `planned_end_date date NULL`

As datas reais permanecem nas colunas existentes:
- **Início real** = `started_at` (já preenchido automaticamente quando o card entra numa coluna com `triggers_started_at = true`, tipicamente "Em progresso").
- **Conclusão real** = `finished_at` (já preenchido quando entra em coluna com `triggers_finished_at = true`, tipicamente "Concluído").

Trigger de validação `validate_demand_planned_end()` em `BEFORE INSERT/UPDATE`:
- Se `planned_end_date IS NOT NULL` e `project_id IS NOT NULL`, buscar `projects.planned_end_date` (fallback `due_date`) e bloquear se a data planejada da demanda for posterior. Erro claro em PT-BR.
- Se `planned_start_date` e `planned_end_date` estiverem ambos preenchidos, garantir `start <= end`.

Sem CHECK constraint (datas comparativas precisam ser trigger, conforme regra do projeto).

### 2. Hook / tipos

- `src/hooks/useDemands.ts`: incluir os 2 novos campos no tipo `DemandRow` e no `select`. `useUpdateDemand` já aceita campos genéricos — sem mudança estrutural.

### 3. UI — `DemandSidebar.tsx`

Nova seção "Datas" (acima ou abaixo de "Esforço"), com 4 linhas no mesmo padrão visual do `ProjectDatesSection`:

| Campo | Editável | Origem |
|---|---|---|
| Início previsto | Sim (popover Calendar) | `planned_start_date` |
| Fim previsto | Sim (popover Calendar) | `planned_end_date` |
| Início real | Não (read-only, badge "automático") | `started_at` |
| Conclusão real | Não (read-only, badge "automático") | `finished_at` |

- Datas planejadas usam `new Date(value + "T00:00:00")` para evitar bug de fuso (mesmo padrão já corrigido em `ProjectDatesSection` / `ProjectCard`).
- Datas reais exibem data + hora curta + "automático ao entrar em <coluna>".
- Botão "Limpar" nas planejadas.
- Quando há `project_id`, mostrar texto auxiliar abaixo de "Fim previsto": *"Limite: <data do projeto>"*. Se o usuário tenta salvar acima, `useUpdateDemand` propaga o erro do trigger via toast.

### 4. Card no Kanban (opcional, escopo mínimo)

`DemandCard` (lib/demandCardData.ts já agrega o card): exibir badge discreto com `planned_end_date` quando definido (ex: 📅 12/06), em estilo neutro. Vermelho se atrasado (today > planned_end e não concluído). Se você preferir manter o card limpo, posso pular essa parte — confirme.

### Arquivos

- `supabase/migrations/<novo>.sql` — colunas + trigger
- `src/hooks/useDemands.ts` — tipo + select
- `src/components/demands/detail/DemandSidebar.tsx` — nova seção "Datas"
- `src/components/demands/DemandCard.tsx` (apenas se quiser badge no card)

Sem mudanças em projects, sla_configs, ordenação Kanban ou anexos.
