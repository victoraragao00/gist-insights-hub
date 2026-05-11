## Problema

Ao editar campos no `DemandDetailPage` (coluna, prioridade, tipo, responsável, área...), a alteração só aparece após refresh manual.

## Causa

O hook `useUpdateDemand` (em `src/hooks/useDemands.ts`, linha 321-324) invalida apenas o queryKey `["demands"]` (lista do kanban), mas **não invalida** o queryKey `["demand", demandId]` usado por `useDemand` na página de detalhe.

Resultado: a mutation grava no banco, o kanban atualiza, mas a página detalhe continua exibindo o cache antigo.

Outras mutations da mesma página (`useMoveDemand`) têm o mesmo problema — invalidam só `["demands"]`.

## Fix

Adicionar `queryClient.invalidateQueries({ queryKey: ["demand"] })` (e `["sla_demands"]` por consistência com outras mutations) em:

- `useUpdateDemand.onSuccess`
- `useMoveDemand.onSuccess` (linha ~222)
- `useCreateDemand.onSuccess` se aplicável (linha ~281)

Isso fará o React Query refetch o detalhe imediatamente após qualquer edição, refletindo na tela na hora.

## Arquivos

- `src/hooks/useDemands.ts` — adicionar invalidações nos `onSuccess` das mutations de update/move.

## Verificação

1. Abrir uma demanda → alterar prioridade via Select → valor atualiza imediatamente.
2. Alterar coluna/área/responsável/tipo → idem.
3. Voltar ao kanban → card também reflete a mudança.
