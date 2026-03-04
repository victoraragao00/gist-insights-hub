

# Diagnóstico: Interações mostrando 0

## Causa raiz

A importação roda em background no `ClientContext`. Quando termina, o React Query **não sabe** que os dados mudaram — o cache do `interactions_count` ainda contém o valor `0` da consulta anterior. Como o `staleTime` é 60s, a query não refaz automaticamente.

## Correção

**Arquivo:** `src/context/ClientContext.tsx`

Após o loop de importação concluir com sucesso (~linha 112, após o `toast.success`), invalidar o cache do React Query:

```ts
queryClient.invalidateQueries({ queryKey: ["interactions_count"] });
```

Para isso, adicionar `useQueryClient()` no `ClientProvider`.

Mudança mínima: 2 linhas adicionadas (import + invalidação no `onSuccess`).

