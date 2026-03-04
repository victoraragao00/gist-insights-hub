

# Diagnóstico: gist-confirm-mapping falhando

## Problema real: NÃO é timeout

Os logs mostram centenas de erros idênticos:
```
Error searching participant: {
  code: "22P02",
  details: 'Expected string or "}", but found "[".',
  message: "invalid input syntax for type json"
}
```

O `.contains("identifiers", [...])` do Supabase JS não está serializando corretamente o array JSONB para a query PostgREST. Cada busca de participante falha, então nenhum participante é atualizado, e a função eventualmente dá timeout por processar 200+ contatos individualmente com queries que falham.

## Correção (2 partes)

### 1. Fix JSONB query in `gist-confirm-mapping`

Substituir `.contains("identifiers", [...])` por `.filter("identifiers", "cs", JSON.stringify([...]))` que serializa o JSON corretamente para o operador `@>` do PostgREST.

Linhas afetadas: ~119 e ~205.

Antes:
```ts
.contains("identifiers", [{ channel: "gist", value: String(m.gist_contact_id) }])
```

Depois:
```ts
.filter("identifiers", "cs", JSON.stringify([{ channel: "gist", value: String(m.gist_contact_id) }]))
```

### 2. Same fix in `ingest-gist-historical`

O mesmo padrão existe no `ingest-gist-historical` — o `participantsByGistId` lookup usa `.select()` que funciona diferente, mas a busca individual de `client_id` na linha ~165 também pode ter problemas. Verificar e aplicar o mesmo fix.

### Arquivos modificados
- `supabase/functions/gist-confirm-mapping/index.ts` — fix 2 `.contains()` calls
- `supabase/functions/ingest-gist-historical/index.ts` — verify/fix similar patterns

### Arquivos NÃO modificados
- `src/pages/ClientsPage.tsx` — sem alteração
- Todos os demais arquivos preservados

