## Causa do 400

O `select` no `DemandSlaQuickSheet` referencia `rfis(code)`, mas a tabela `rfis` não tem coluna `code` — o identificador correto é `rfi_number` (formato `RFI-0001`, gerado por trigger). Isso quebra a query inteira → HTTP 400.

## Causa do warning de acessibilidade

O `<SheetTitle>` é renderizado apenas dentro do branch "carregado". Enquanto o sheet abre em estado de loading/erro, o `SheetContent` fica sem `SheetTitle` → Radix avisa.

## Correções em `src/components/demands/DemandSlaQuickSheet.tsx`

1. **Acessibilidade sempre presente:** mover um `<SheetTitle>` (`sr-only` quando o título real ainda não está disponível) para o topo do `SheetContent`, fora do branch condicional. Também adicionar `<SheetDescription className="sr-only">` para resolver o warning de `aria-describedby`.
2. **Query corrigida:**
   - Trocar `rfis(code)` por `rfis(rfi_number)`.
   - Tipar `rfis` como `{ rfi_number: string }[]` e renderizar `demand.rfis[0].rfi_number`.
   - Guard `if (!demandId) return null` dentro do `queryFn` (defesa em profundidade, mesmo já tendo `enabled`).
3. **Estado de erro:** capturar `error` do `useQuery` e, quando houver erro ou `demand === null`, renderizar mensagem "Não foi possível carregar os dados da demanda." + botão "Abrir demanda completa" (quando `demandId` existir) que navega para `/demands/:id` e fecha o sheet. Manter o skeleton para `isLoading` puro.
4. **m11:** garantir que nenhum import fique sobrando após a refatoração (provável adição de `SheetDescription` à lista de imports já existente do sheet).

## Verificação

1. Abrir uma demanda no painel de SLA → console limpo (sem 400, sem warning de DialogTitle/Description).
2. Sheet carrega normalmente; quando há RFI vinculada, exibe `RFI-XXXX`.
3. Forçar erro (ex.: ID inválido) → vê fallback com botão funcional.