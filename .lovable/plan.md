## Plano

1. **Corrigir a regra no banco**
   - Atualizar a função `get_project_stats(p_project_id)` para considerar o projeto como `active` quando existir demanda vinculada em coluna de andamento, não apenas quando `demands.started_at` já foi preenchido.
   - A regra ficará: `cancelled` > `completed` > `active` se houver demanda não cancelada com `started_at IS NOT NULL`, concluída, ou em coluna com `ticket_columns.triggers_started_at = true` > `planning`.

2. **Preservar comportamento atual de conclusão/cancelamento**
   - Manter `completed` quando 100% das demandas estiverem em coluna finalizada.
   - Manter `cancelled` quando o projeto tiver `cancelled_at`.

3. **Ajustar atualização visual após mover demanda**
   - No hook de movimentação de demandas, invalidar também `project_stats` e `projects` para os cards/listas refletirem o novo status sem esperar o cache expirar.

4. **Verificação**
   - Validar que um projeto com demanda em `Em Progresso` passa de `Planejamento` para `Ativo`.
   - Validar que projetos sem demandas em andamento continuam como `Planejamento`.

## Detalhe técnico

A coluna `Em Progresso` já está configurada com `triggers_started_at = true`. O problema é que o status do projeto depende só de `demands.started_at`; se esse campo não foi gravado em algum fluxo, o projeto continua aparecendo como `Planejamento`. A correção torna a função mais resiliente usando também a configuração da coluna.