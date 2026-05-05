## Estado atual

A implementação do Sprint 3-A revisado já cobriu ~95% do escopo do 3-B revisado. Verifiquei os arquivos e o que está pronto:

| Item OBRIGATÓRIO | Status |
|---|---|
| 1. Filtro `workspace='cx'` no Kanban CX | OK — `useDemands` aplica `.eq("workspace", filters.workspace)` (linha 84) |
| 2. Filtro `workspace='tech'` + swimlane | OK — branch em `DemandsPage.tsx:304` |
| 3. Raias = `demand_areas` com `workspace IN ('tech','both')` + `active=true` | OK — `useAreasByWorkspace("tech")` |
| 4. DnD horizontal muda `column_id`, vertical muda `area_id` | OK — `TechSwimlanePage.handleDragEnd` |
| 5. `CreateDemandDialog` define workspace pelo workspace ativo | OK — recebe prop `workspace`, insere com ele (linha 102) |
| 6. Settings → Áreas com seletor cx/tech/both por área | OK — `AreaSettingsTab.tsx` linhas 212-226 |
| 7. Layout flat CX preservado | OK — branch só ativa swimlane se `activeWorkspace === "tech"` |
| 8. `staleTime > 0` em todas queries | OK |
| 9. `useMutation` para escrita | OK |
| 10. `{ data, error }` destructurado | OK |

## Gaps identificados (pequenos)

1. **`useDemands` queryKey (m5):** o key é `["demands", user?.id, filters]` — `filters` é objeto recriado, mas funcional. Aceitável.
2. **Filtro Área no Kanban CX:** o `<FilterCombobox>` de Área lista todas as áreas (`useDemandAreas()`), incluindo as `tech`. No workspace CX deveria filtrar áreas com `workspace IN ('cx','both')`, e no TECH com `('tech','both')`.
3. **Empty state vazio no swimlane TECH:** mensagem "Nenhuma demanda encontrada com filtros" precede o branch `tech` em `DemandsPage.tsx:300-305` — ordem está correta, mas vale confirmar que swimlane também aparece quando `demands.length === 0` sem filtros (atualmente cai no branch tech, OK).

## Mudanças propostas

### 1. `src/pages/DemandsPage.tsx`
- Filtrar `areas` exibidas no Combobox de filtro pela mesma regra do swimlane: `useAreasByWorkspace(activeWorkspace)` em vez de `useDemandAreas()` para o select de filtro.
- Resetar `filterArea` quando `activeWorkspace` mudar (área selecionada pode não existir no novo workspace).

### 2. Verificação manual pós-deploy
Rodar a checklist 1–12 do prompt no preview.

## Não vou alterar

- `TechSwimlanePage.tsx` — completo e funcional
- `AreaSettingsTab.tsx` — seletor já presente
- `CreateDemandDialog.tsx` — já filtra áreas por workspace
- `useDemandAreas.ts` / `useDemands.ts` — sem mudanças necessárias
- Migrations — proibido
