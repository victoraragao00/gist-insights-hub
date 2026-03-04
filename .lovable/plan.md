

# Fix: ingest-gist-historical timeout

## Problema
A função tenta processar TODAS as conversas do Gist em uma única execução. Com centenas de conversas × mensagens paginadas × delays de rate-limit, ultrapassa o timeout de 150s das Edge Functions.

Além disso, dentro do loop de conversas há uma query desnecessária ao banco por conversa (`participants.select("client_id")`), adicionando latência.

## Solução

### 1. Remover query redundante no loop de conversas
A função já carrega todos os `participants` e `channel_bindings` no início. A query extra por conversa para buscar `client_id` é redundante — o `client_id` já está disponível nos dados do participante carregados inicialmente.

Alterar a interface `ParticipantRow` para incluir `client_id`, e carregá-lo no `.select()` inicial. Remover a query individual dentro do loop.

### 2. Adicionar suporte a paginação por request (chunked processing)
Aceitar um parâmetro opcional `page` no body da requisição. A função processará apenas N conversas por invocação (ex: 20). Se houver mais, retorna `has_more: true` e o `next_page`.

O frontend chama a função em loop, acumulando resultados, até `has_more === false`.

### 3. Atualizar o frontend para chamar em loop
O `handleImportHistory` passa a chamar a função repetidamente com `page` incrementando, mostrando progresso parcial ao usuário ("Importando página 1... 2... 3...").

### Arquivos modificados
- `supabase/functions/ingest-gist-historical/index.ts` — chunked processing + remove redundant query
- `src/pages/ClientsPage.tsx` — loop de chamadas com progresso

### Arquivos NÃO modificados
- Nenhum outro arquivo será alterado

