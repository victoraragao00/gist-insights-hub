# Prompt Lovable — Unificar assignees: demand_assignees → user_profiles

> **Issue:** https://github.com/HyTrackWater/gist-insights-hub/issues/71
> **Tipo:** Refactor — eliminar redundância entre demand_assignees e user_profiles
> **Repo:** https://github.com/HyTrackWater/gist-insights-hub
> **Supabase project:** qyfwbmukylyfsgzgocfo

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

---

## OBRIGATÓRIO

1. Migrations via migration tool
2. Manter RLS sem sub-select em `user_client_access`
3. `useMutation` para toda escrita (m9)
4. `sonner` para toasts (m3)
5. Erros Supabase tratados (m8)
6. NÃO dropar a tabela `demand_assignees` — apenas desacoplar
7. Manter TODO o código existente que não é mencionado neste prompt

## PROIBIDO

1. Tocar em `src/integrations/supabase/*`, `supabase/config.toml`, `.env`
2. Dropar a tabela `demand_assignees`
3. Reverter código de componentes não mencionados

---

## Problema

Existem duas entidades separadas fazendo a mesma coisa:
- `demand_assignees` — nomes livres sem vínculo com login
- `user_profiles` — usuários reais com acesso ao sistema

`demands.assignee_id` aponta para `demand_assignees.id`. Isso é redundante e inconsistente — qualquer pessoa sem login pode ser "responsável" por uma demanda.

## Solução

Unificar: `assignee_id` passa a referenciar `user_profiles.id`. A aba "Responsáveis de Tarefas" some de Configurações.

---

## PARTE 1 — MIGRATION

### Migration 1: RLS permissiva + limpeza de assignee_id

**PROBLEMA DE RLS:** Atualmente, viewers só veem o próprio perfil em `user_profiles` (policy `user_profiles_select_own`). O dropdown de responsável precisa listar TODOS os usuários ativos. Sem nova policy, viewers só veriam a si mesmos.

```sql
-- Permitir que qualquer autenticado leia perfis ativos (necessário para dropdown de responsável)
-- Não expõe dados sensíveis — email já visível em outros contextos do sistema
CREATE POLICY user_profiles_select_active ON user_profiles
  FOR SELECT TO authenticated
  USING (active = true);

-- Nullify assignee_id onde o UUID aponta para demand_assignees (não existe em user_profiles)
UPDATE demands
SET assignee_id = NULL
WHERE assignee_id IS NOT NULL
  AND assignee_id NOT IN (SELECT id FROM user_profiles);
```

**Nota:** A tabela `demand_assignees` NÃO é dropada. Apenas desacoplada. O `assignee_id` é limpo para evitar referências órfãs.

---

## PARTE 2 — HOOKS

### Atualizar `src/hooks/useDemands.ts`

**Linha 19 — type DemandRow:**
```typescript
// ANTES
demand_assignees?: { name: string } | null;

// DEPOIS
user_profiles?: { full_name: string | null; email: string | null } | null;
```

**Linha 71 — query select:**
```typescript
// ANTES
.select("*, clients(name), demand_types(name, color, icon), ticket_columns(name, color), demand_areas(name, color), demand_assignees(name)")

// DEPOIS
.select("*, clients(name), demand_types(name, color, icon), ticket_columns(name, color), demand_areas(name, color), user_profiles!assignee_id(full_name, email)")
```

**NOTA:** O join usa `user_profiles!assignee_id` para indicar ao PostgREST que o FK join é via `demands.assignee_id → user_profiles.id`. Sem o `!assignee_id`, o PostgREST não sabe qual FK usar (pode haver ambiguidade com `created_by`).

### Atualizar `src/hooks/useClientDemands.ts`

**Linha 13 — type:**
```typescript
// ANTES
demand_assignees: { name: string } | null;

// DEPOIS
user_profiles: { full_name: string | null; email: string | null } | null;
```

**Linha 29 — query select:**
```typescript
// ANTES
demand_assignees(name)

// DEPOIS
user_profiles!assignee_id(full_name, email)
```

---

## PARTE 3 — FRONTEND

### `src/components/demands/DemandCard.tsx`

Onde exibe o nome do responsável:
```typescript
// ANTES
demand.demand_assignees?.name

// DEPOIS
demand.user_profiles?.full_name ?? demand.user_profiles?.email ?? null
```

### `src/components/demands/CreateDemandDialog.tsx`

**Remover:** `import { useDemandAssignees } from "@/hooks/useDemandAssignees"`

**Substituir:** `const { data: assignees = [] } = useDemandAssignees()` por uma query direta de `user_profiles`:
```typescript
const { data: userProfiles = [] } = useQuery({
  queryKey: ["user_profiles_active"],
  staleTime: 300_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});
```

**Select de responsável:** iterar `userProfiles` em vez de `assignees`:
```tsx
{userProfiles.map((u) => (
  <SelectItem key={u.id} value={u.id}>
    {u.full_name ?? u.email}
  </SelectItem>
))}
```

### `src/components/demands/DemandDetailSheet.tsx`

**Remover:** `import { useDemandAssignees } from "@/hooks/useDemandAssignees"`

**Substituir:** `const { data: assignees = [] } = useDemandAssignees()` pela mesma query `user_profiles_active` acima.

**Select de responsável:** mesma mudança do CreateDemandDialog.

### `src/pages/SettingsPage.tsx`

**Remover:**
- Import: `import { AssigneeSettingsTab } from "@/components/demands/AssigneeSettingsTab"`
- TabsTrigger: `{isAdmin && <TabsTrigger value="assignees">Responsáveis</TabsTrigger>}`
- TabsContent: `<TabsContent value="assignees"><AssigneeSettingsTab /></TabsContent>`

### `src/pages/ClientDetailPage.tsx`

Se a tab "Demandas" exibe o assignee, trocar referência de `demand_assignees` para `user_profiles`.

---

## ESCOPO DE ARQUIVOS

| Arquivo | Ação |
|---|---|
| Nova migration | RLS permissiva + nullify assignee_id órfãos |
| `src/hooks/useDemands.ts` | Join demand_assignees → user_profiles!assignee_id |
| `src/hooks/useClientDemands.ts` | Idem |
| `src/components/demands/DemandCard.tsx` | Exibir full_name/email |
| `src/components/demands/CreateDemandDialog.tsx` | Select de user_profiles ativos |
| `src/components/demands/DemandDetailSheet.tsx` | Select de user_profiles ativos |
| `src/pages/SettingsPage.tsx` | Remover aba Responsáveis |
| `src/pages/ClientDetailPage.tsx` | Atualizar referência assignee |

**NÃO tocar:** `demand_assignees` table, `AssigneeSettingsTab.tsx` (fica no repo mas sem uso), `useDemandAssignees.ts` (idem).

---

## VERIFICAÇÃO

1. Dropdown de responsável no CreateDemandDialog lista usuários reais (`user_profiles`)?
2. Dropdown de responsável no DemandDetailSheet lista usuários reais?
3. DemandCard exibe `full_name` (ou email como fallback) do responsável?
4. Tab "Demandas" na ClientDetailPage exibe nome correto do responsável?
5. Aba "Responsáveis de Tarefas" NÃO aparece mais em Configurações?
6. Viewer consegue ver todos os nomes no dropdown (não só o próprio)?
7. Demandas que tinham assignee_id apontando para demand_assignees agora mostram "Sem responsável"?
8. Criar nova demanda com responsável → salva corretamente o `user_profiles.id`?

Reportar ao Operador: os 8 itens passaram?
