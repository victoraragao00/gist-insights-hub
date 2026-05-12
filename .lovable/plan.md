## Objetivo

Permitir um motivo de bloqueio "Outro" com texto livre obrigatório, e dar ao admin uma tela de configuração para criar/editar/desativar tipos de bloqueio.

## Mudanças

### 1. Banco — `blocker_types`

Migration:
- Adicionar coluna `requires_reason boolean not null default false`.
- Atualizar tipos existentes que devem exigir motivo (set `true` no tipo "Outro" se já existir).
- Inserir o tipo `"Outro"` com `requires_reason = true`, `icon = '✏️'`, cor neutra, posição no fim — apenas se ainda não existir (`ON CONFLICT (name) DO NOTHING` ou `WHERE NOT EXISTS`).

RLS já existe e cobre admins. Sem alteração de policies.

### 2. Hook

`src/hooks/useBlockerTypes.ts`:
- `BlockerType` já vem de `Tables<"blocker_types">`, então pega `requires_reason` automaticamente após regen de types.
- Adicionar `requires_reason` aos parâmetros de `useCreateBlockerType` e `useUpdateBlockerType`.

### 3. Diálogo "Marcar como bloqueado" — `DemandSidebar.tsx`

- Recuperar o tipo selecionado: `const selected = blockerTypes.find(b => b.id === selectedBlockerType)`.
- Quando `selected?.requires_reason === true`:
  - Trocar label do textarea para `Motivo *` (obrigatório).
  - Trocar placeholder para `Descreva o motivo do bloqueio...`.
  - Botão Confirmar fica `disabled` se `blockerReason.trim()` estiver vazio.
- Caso contrário: comportamento atual ("Motivo (opcional)").
- O backend já grava `blocker_reason` — sem mudança no `handleBlock`.

(O diálogo do `DemandDetailSheet.tsx` é uma versão legada que nem usa `blocker_type_id`. Fora do escopo desta task — deixar como está.)

### 4. Settings — nova aba "Bloqueios"

Criar `src/components/settings/BlockerTypesSettingsTab.tsx`, espelhando `DemandTypesSettingsTab`:
- Form de adição: Nome, Cor, Ícone, Switch "Exige motivo", botão Adicionar.
- Tabela com colunas: Ordem (↑ ↓), Nome (inline edit), Cor, Ícone, Exige motivo (Switch), Ativo (Switch).
- Reaproveita `useAllBlockerTypes`, `useCreateBlockerType`, `useUpdateBlockerType`, `useToggleBlockerTypeActive`.

Em `src/pages/SettingsPage.tsx`:
- Importar `BlockerTypesSettingsTab`.
- Adicionar `<TabsTrigger value="blockers">Bloqueios</TabsTrigger>` (admin only) próximo de "Tipos".
- Adicionar `<TabsContent value="blockers"><BlockerTypesSettingsTab /></TabsContent>`.

## Arquivos
- migration nova
- `src/hooks/useBlockerTypes.ts`
- `src/components/demands/detail/DemandSidebar.tsx`
- `src/components/settings/BlockerTypesSettingsTab.tsx` (novo)
- `src/pages/SettingsPage.tsx`