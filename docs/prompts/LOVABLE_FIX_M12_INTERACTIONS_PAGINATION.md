# Prompt Lovable — Fix M12: Paginacao em InteractionsFeed

> Repositorio: https://github.com/HyTrackWater/gist-insights-hub
> Prioridade: ALTA
> Dependencias: Nenhuma
> Auditoria ref: auditorias/AUDITORIA_20260322_1500.md (M12)

---

## OBRIGATORIO

1. Em `src/components/InteractionsFeed.tsx`, na query principal (linha ~502-516), adicionar `.limit(500)` para evitar retornar milhares de rows:

   **Codigo atual:**
   ```typescript
   const { data: rawInteractions, isLoading } = useQuery({
     queryKey: ["conversations", clientId, period],
     enabled: !!clientId,
     staleTime: 30_000,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("interactions")
         .select("id, content, occurred_at, sender_raw, sender_side, tone, theme, classified_at, raw_payload, attachments")
         .eq("client_id", clientId)
         .gte("occurred_at", dateFrom)
         .order("occurred_at", { ascending: true });
       if (error) throw error;
       return (data ?? []) as Interaction[];
     },
   });
   ```

   **Codigo corrigido:**
   ```typescript
   const PAGE_SIZE = 500;

   const { data: rawInteractions, isLoading } = useQuery({
     queryKey: ["conversations", clientId, period],
     enabled: !!clientId,
     staleTime: 30_000,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("interactions")
         .select("id, content, occurred_at, sender_raw, sender_side, tone, theme, classified_at, raw_payload, attachments")
         .eq("client_id", clientId)
         .gte("occurred_at", dateFrom)
         .order("occurred_at", { ascending: false })
         .limit(PAGE_SIZE);
       if (error) throw error;
       return (data ?? []).reverse() as Interaction[];
     },
   });
   ```

   **Nota:** A ordem muda para `ascending: false` + `.limit(PAGE_SIZE)` + `.reverse()` para pegar as 500 mensagens MAIS RECENTES do periodo, e depois reordena para exibicao cronologica. Isso garante que se houver mais de 500 msgs, as mais recentes (mais relevantes) sao exibidas.

2. Adicionar indicador visual quando o limite foi atingido. Apos a linha do `totalMessages` (~542), adicionar:

   ```typescript
   const isLimitReached = (rawInteractions?.length ?? 0) >= PAGE_SIZE;
   ```

   E no JSX, antes da lista de conversas, se `isLimitReached`, renderizar um banner:

   ```tsx
   {isLimitReached && (
     <div className="mx-4 mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
       Exibindo as {PAGE_SIZE} mensagens mais recentes do periodo. Reduza o periodo para ver todas.
     </div>
   )}
   ```

---

## PROIBIDO

1. NAO alterar a logica de buildConversations ou filteredConversations
2. NAO remover os filtros existentes (tone, search, period)
3. NAO implementar paginacao infinita (scroll) — o limit de 500 e suficiente para 30 dias de qualquer cliente
4. NAO alterar outros componentes ou hooks
5. NAO tomar decisoes autonomas

---

## Problema

`InteractionsFeed` busca TODAS as interactions de um client_id dentro do periodo sem `.limit()` ou `.range()`. Para clientes com alto volume (By NV tem ~117 conversas/mes), isso pode retornar milhares de linhas, impactando performance e memoria do browser.

**Checklist CTO m12:** "Paginacao real em listas > 50 itens"

---

## Verificacao pos-deploy

1. Abrir ClientDetailPage de um cliente com muitas interactions (By NV)
2. Tab "Conversas" deve carregar rapido (< 2s)
3. Se houver mais de 500 msgs no periodo, banner amarelo deve aparecer
4. Reduzir periodo para 7 dias → banner deve sumir (menos msgs)

---

## Frontend Contract

```typescript
// Query retorna no maximo PAGE_SIZE (500) interactions
// Ordenadas por occurred_at ascending (cronologico) apos reverse
// isLimitReached: boolean — true se retornou exatamente PAGE_SIZE rows
```

---

## Checklist CTO aplicavel

- [x] m12: Paginacao / limit em listas > 50
- [x] m4: staleTime 30s (mantido)
- [x] m5: queryKey inclui clientId e period (mantido)
- [x] m8: Erros Supabase tratados (throw error mantido)
