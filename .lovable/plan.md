

## Plan: 4 marcadores configuráveis nas colunas — Demanda (Início/Fim) + SLA (Início/Fim)

### Contexto atual

A tabela `ticket_columns` tem 2 flags booleanas:
- `triggers_started_at` — hoje serve tanto como "início de desenvolvimento" quanto "fim do SLA de resposta"
- `triggers_finished_at` — "fim da demanda"

O usuário quer **4 marcadores independentes e configuráveis**:

| Marcador | Significado | Exemplo |
|----------|------------|---------|
| Início Demanda | Cronômetro de desenvolvimento inicia | "Em Progresso" |
| Fim Demanda | Demanda concluída | "Concluído" |
| Início SLA | SLA de resposta começa (criação do ticket — implícito, mas marcador visual) | Criação |
| Fim SLA | SLA de resposta encerra | "A Fazer" |

Na prática, o **Início do SLA** é sempre na criação do ticket (não precisa de coluna), então precisamos de 1 novo campo: `triggers_sla_response_at` (booleano) para marcar onde o SLA de resposta **encerra**.

### 1. Migration — Novo campo na tabela `ticket_columns`

```sql
ALTER TABLE public.ticket_columns
  ADD COLUMN IF NOT EXISTS triggers_sla_response_at BOOLEAN DEFAULT false;
```

Atualizar o trigger `mark_sla_first_response` para usar `triggers_sla_response_at` em vez de `triggers_started_at`:

```sql
CREATE OR REPLACE FUNCTION public.mark_sla_first_response()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.column_id != OLD.column_id AND NEW.sla_first_response_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM ticket_columns
      WHERE id = NEW.column_id AND triggers_sla_response_at = true
    ) THEN
      NEW.sla_first_response_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

Também migrar dados existentes: copiar o valor atual de `triggers_started_at` para `triggers_sla_response_at` para não perder configuração.

### 2. Edit `src/components/demands/ColumnSettingsTab.tsx`

Separar os badges em dois grupos visuais:

**Badges de Demanda:**
- `triggers_started_at` → badge "Início Dev" (tooltip: "Cronômetro de desenvolvimento inicia quando o ticket entra nesta coluna")
- `triggers_finished_at` → badge "Fim" (tooltip: "Marca o ticket como concluído")

**Badge de SLA:**
- `triggers_sla_response_at` → badge "Fim SLA" (tooltip: "O SLA de primeira resposta encerra quando o ticket entra nesta coluna")

Adicionar botões de toggle para cada marcador em cada linha de coluna — clicar no badge ativa/desativa o marcador (com mutation de update).

Atualizar o Alert informativo:
> **Cronômetros:** O SLA de resposta inicia na criação do ticket e encerra na coluna marcada "Fim SLA". O desenvolvimento inicia na coluna "Início Dev" e encerra na coluna "Fim".

### 3. New hook — `useUpdateColumnTriggers`

Em `src/hooks/useManageColumns.ts`, adicionar mutation para atualizar os 3 flags booleanos de uma coluna:

```typescript
export function useUpdateColumnTriggers() {
  // mutate({ id, field, value }) → supabase.update({ [field]: value })
  // Quando ativar um flag exclusivo (triggers_started_at, triggers_sla_response_at, triggers_finished_at),
  // desativar o mesmo flag em todas as outras colunas primeiro
}
```

### 4. Edit `src/hooks/useDemands.ts` — `useMoveDemand`

Manter a lógica existente de `triggers_started_at`/`triggers_finished_at` para cronômetro de demanda (sem mudança). O SLA já é tratado pelo trigger no banco via `triggers_sla_response_at`.

### 5. Update `src/components/demands/SlaView.tsx` e `src/hooks/useSla.ts`

Sem mudanças necessárias — a RPC `get_demands_with_sla` já usa o trigger do banco. A migration atualiza o trigger para usar o novo campo.

### 6. Update Alert/descrição no `ColumnSettingsTab`

Atualizar texto explicativo para refletir os 4 marcadores.

### Files changed

| Action | File |
|--------|------|
| Migration | Add `triggers_sla_response_at` + update trigger + migrate data |
| Edit | `src/components/demands/ColumnSettingsTab.tsx` (3 badges configuráveis com toggle) |
| Edit | `src/hooks/useManageColumns.ts` (nova mutation `useUpdateColumnTriggers`) |

### No changes to
- `useDemands` move logic, `useSla.ts`, `SlaView.tsx`, other pages, `src/integrations/supabase/*`, `.env`

