

## Plan: Aba SLA nas Configurações

### 1. Novo hook — `src/hooks/useSlaConfigs.ts`

- `useSlaConfigs(clientId?)` — query com `staleTime: 60_000`, filtra por `client_id.is.null` (global) ou `or(client_id.eq.X, client_id.is.null)` (cliente)
- `useUpsertSlaConfig()` — `useMutation` com `onConflict: "client_id,priority"`, invalida `["sla_configs"]`, toast sonner
- `useResetSlaConfig()` — `useMutation` que deleta override do cliente, invalida queries, toast sonner

### 2. Novo componente — `src/components/settings/SlaSettingsTab.tsx`

- Busca lista de clientes via query simples em `clients`
- **Seção Global**: Tabela com 4 prioridades (urgent/high/medium/low), inputs numéricos, botão "Salvar padrões" com `isDirty` check
- **Seção por Cliente**: Select de cliente + tabela com coluna "Origem" (badge Global/Personalizado) + botão Reset para overrides + botão "Salvar configuração do cliente"
- `useMemo` para separar globalConfigs vs clientConfigs
- Draft state (`globalDraft`, `clientDraft`) para detectar dirty

### 3. Integrar em `src/pages/SettingsPage.tsx`

- Linha 632: adicionar `{isAdmin && <TabsTrigger value="sla">SLA</TabsTrigger>}`
- Linha 1131 (após users TabsContent): adicionar `{isAdmin && <TabsContent value="sla"><SlaSettingsTab /></TabsContent>}`
- Import `SlaSettingsTab`

### Files changed

| Action | File |
|--------|------|
| New | `src/hooks/useSlaConfigs.ts` |
| New | `src/components/settings/SlaSettingsTab.tsx` |
| Edit | `src/pages/SettingsPage.tsx` (tab trigger + content + import) |

### No changes to
- Migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

