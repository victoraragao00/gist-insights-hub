# Prompt Lovable — Fix B1: Edição inline não atualiza em tempo real

> **Issue:** https://github.com/HyTrackWater/gist-insights-hub/issues/66
> **Severidade:** Crítico — bloqueia uso real do módulo de Tickets
> **Origem:** Validação Vitor — S1-C

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

---

## OBRIGATÓRIO

- Editar APENAS os arquivos listados no escopo
- Manter TODO o código existente que não é mencionado neste prompt
- Testar visualmente que a edição reflete na tela IMEDIATAMENTE após blur/select
- NÃO adicionar Realtime subscription — o fix é via React Query cache + state management

## PROIBIDO

- Criar arquivos novos
- Alterar queryKeys existentes
- Remover invalidateQueries do useUpdateDemand
- Alterar lógica de mutations (mutationFn) — apenas onSuccess/onMutate/onSettled
- Reverter código de outros componentes (DemandCard, KanbanColumn, etc.)

---

## Problema

Ao editar qualquer campo no DemandDetailSheet, a mutation salva no banco com sucesso, mas o campo visual NÃO atualiza na tela. Só ao fechar e reabrir o Sheet o valor novo aparece.

**Causa raiz (2 problemas combinados):**

### Problema 1 — Estado stale no parent

**Arquivo:** `src/pages/DemandsPage.tsx` (linha ~105)

```tsx
// ATUAL (stale)
const [selectedDemand, setSelectedDemand] = useState<DemandRow | null>(null);
```

`selectedDemand` armazena o OBJETO inteiro. Quando a query refetch após mutation, a lista `demands` atualiza no cache, mas `selectedDemand` continua sendo o objeto antigo. Os Select fields (Tipo, Prioridade, Coluna, Área, Responsável) leem direto de `demand.*` e NÃO atualizam.

### Problema 2 — useState não re-sincroniza com props

**Arquivo:** `src/components/demands/DemandDetailSheet.tsx` (linhas ~96-100)

```tsx
// ATUAL (inicializa uma vez, nunca re-sincroniza)
const [title, setTitle] = useState(demand.title);
const [description, setDescription] = useState(demand.description ?? "");
```

`useState` só usa o valor inicial. Mesmo que o parent passe um `demand` atualizado, o state local permanece stale.

---

## Fix

### Fix 1 — `src/pages/DemandsPage.tsx`

Armazenar apenas o ID, derivar o objeto da lista:

```tsx
// ANTES
const [selectedDemand, setSelectedDemand] = useState<DemandRow | null>(null);

// DEPOIS
const [selectedDemandId, setSelectedDemandId] = useState<string | null>(null);
const selectedDemand = useMemo(
  () => demands.find((d) => d.id === selectedDemandId) ?? null,
  [demands, selectedDemandId]
);
```

Atualizar TODOS os locais que chamam `setSelectedDemand(demand)` para `setSelectedDemandId(demand.id)`.

Atualizar o `onOpenChange` do Sheet:
```tsx
// Se o Sheet fecha, limpar o ID
onOpenChange={(open) => {
  setSheetOpen(open);
  if (!open) setSelectedDemandId(null);
}}
```

### Fix 2 — `src/components/demands/DemandDetailSheet.tsx`

Adicionar `useEffect` para re-sincronizar o state local quando o `demand` prop muda (após refetch):

```tsx
import { useState, useCallback, useRef, useEffect } from "react";

// Dentro de DemandDetailContent, APÓS os useState (linhas ~96-100):
useEffect(() => {
  setTitle(demand.title);
  setDescription(demand.description ?? "");
  setExpectedResult(demand.expected_result ?? "");
  setNotes(demand.notes ?? "");
  setRfiUrl(demand.rfi_url ?? "");
}, [demand.id, demand.title, demand.description, demand.expected_result, demand.notes, demand.rfi_url]);
```

**IMPORTANTE:** As dependências do useEffect incluem cada campo individual (`demand.title`, `demand.description`, etc.) — NÃO usar `demand` como objeto inteiro (causaria loop infinito com referência instável).

---

## Escopo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/DemandsPage.tsx` | Trocar `selectedDemand` state por `selectedDemandId` + derivação |
| `src/components/demands/DemandDetailSheet.tsx` | Adicionar useEffect de sincronização |

---

## Verificação

Após implementar, testar CADA cenário:

1. Abrir uma demand → editar o título (blur) → o título deve atualizar na tela IMEDIATAMENTE
2. Alterar prioridade via Select → o Select deve mostrar o novo valor IMEDIATAMENTE
3. Alterar área via Select → idem
4. Alterar responsável via Select → idem
5. Editar descrição (blur) → deve refletir imediatamente
6. Mover para outra coluna via Select no Sheet → coluna deve atualizar
7. Verificar que o toast "Demanda atualizada" continua aparecendo
8. Verificar que o DemandCard no Kanban também reflete a mudança (pois a lista refetch)
9. Verificar que NÃO há loop de re-renders (abrir console, não deve ter re-renders infinitos)
