## Contexto

Hoje o painel SLA (`SlaView.tsx`) reaproveita o `DemandDetailSheet` — um sheet pesado de edição completa, sem scroll bem definido e sem botão para abrir a página completa. O prompt pede um sheet **somente leitura** e enxuto, específico para o SLA.

## Decisão

Não vou modificar o `DemandDetailSheet` (usado em vários outros lugares como editor completo). Em vez disso, vou:

1. Criar um novo componente `src/components/demands/DemandSlaQuickSheet.tsx` — sheet read-only com scroll interno, header fixo, footer fixo e botão "Abrir demanda completa" → `/demands/:id`.
2. Trocar o uso em `src/components/demands/SlaView.tsx` para o novo componente (remove o uso atual do `DemandDetailSheet` e do hook `useDemands` que era usado só para isso, já que o `DemandWithSla` retornado por `useSlaDemandsBoard` já tem os campos básicos — para o restante (descrição, notas, resolução, RFI) buscaremos com uma query leve).

## Arquivos

### Novo: `src/components/demands/DemandSlaQuickSheet.tsx`

- Props: `{ demandId: string | null; open: boolean; onOpenChange: (b: boolean) => void }`.
- Dentro, faz uma query (`useQuery`, key `["demand_sla_quick", demandId]`, `staleTime: 30_000`, `enabled: open && !!demandId`) selecionando da tabela `demands` apenas o necessário:
  ```
  id, title, description, expected_result, notes, resolution, priority,
  clients(name),
  demand_types(name, color),
  demand_areas(name, color),
  ticket_columns(name, color),
  user_profiles!assignee_id(full_name, email),
  rfis(code)
  ```
- Layout:
  - `<SheetContent side="right" className="w-full sm:max-w-[560px] flex flex-col p-0 overflow-hidden">`
  - Header `shrink-0` com `<SheetTitle>` (título), botão "Abrir completo" (ícone `ExternalLink`) e linha de badges (tipo / área / prioridade / coluna). Badges com tokens semânticos (`variant="outline"` + `bg-muted`/`text-muted-foreground`) — sem cores hardcoded `bg-teal-50` etc., conforme design system.
  - Body `flex-1 overflow-y-auto px-6 py-4 space-y-5` com:
    - Grid 2 col: Responsável, Cliente, RFI (se houver).
    - `ReadOnlyField` para Descrição, Resultado esperado, Resolução.
    - `ExpandableField` para Notas internas (campo real é `notes`).
  - Footer `shrink-0` com botão `w-full` "Abrir demanda completa".
- Componentes auxiliares `ReadOnlyField` e `ExpandableField` definidos no mesmo arquivo, conforme spec do prompt (threshold ~80px, `useEffect` mede `scrollHeight`, toggle Ver mais/Ver menos com `ChevronDown/Up`).
- Skeleton enquanto carrega.
- `useNavigate` do `react-router-dom` para o botão; chama `onOpenChange(false)` antes de navegar.

### Editado: `src/components/demands/SlaView.tsx`

- Remover imports `DemandDetailSheet`, `useDemands`, `DemandRow` (m11).
- Remover `useDemands({})` e `selectedDemand` (não precisa mais carregar a lista inteira só para abrir o detalhe).
- Trocar o `<DemandDetailSheet ... />` por `<DemandSlaQuickSheet demandId={selectedId} open={sheetOpen} onOpenChange={setSheetOpen} />`.

## Checklist CTO aplicável

- m1: sem `any`.
- m4/m5: queryKey inclui `demandId`, staleTime 30s.
- m8: `{ data, error }` destructurado, `throw error`.
- m11: imports não usados removidos do `SlaView.tsx`.
- Design system: badges com tokens semânticos (`bg-muted`, `text-muted-foreground`, `border-border`), nada de `bg-teal-50` cru.

## Verificação

1. Painel SLA → clicar numa demanda → sheet abre com header (título + badges + botão).
2. Body do sheet rola; header e footer fixos.
3. Descrição/Resultado/Resolução exibidos sem scrollbar interna; alturas crescem com conteúdo.
4. Notas longas → truncadas + "Ver mais"; expandidas → "Ver menos".
5. Botão "Abrir completo" (header) e "Abrir demanda completa" (footer) → navegam para `/demands/:id` e fecham o sheet.
6. Largura ~560px no desktop; full-width no mobile.