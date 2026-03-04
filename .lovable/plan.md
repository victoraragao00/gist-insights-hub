

# Clientes importados não aparecem — falta `user_client_access`

## Diagnóstico

O cliente **Osklen** existe no banco (dois registros: `osklen.com.br` e `Osklen`). Porém, a tabela `user_client_access` do seu usuário só contém acesso ao `By NV`. Como a RLS da tabela `clients` filtra por `user_accessible_client_ids(auth.uid())`, todos os clientes criados pela importação ficam invisíveis.

**Causa raiz:** A edge function `gist-confirm-mapping` cria clientes novos usando `service_role` mas nunca insere uma linha em `user_client_access` para o usuário que disparou a importação.

## Correção

**Arquivo:** `supabase/functions/gist-confirm-mapping/index.ts`

1. Extrair o `user_id` do token JWT da request (via header `Authorization`)
2. Após criar cada novo cliente (linha 61-73), inserir em `user_client_access`:
   ```ts
   await supaAdmin.from('user_client_access').insert({
     user_id: callerUserId,
     client_id: newClient.id,
     role: 'admin',
   });
   ```
3. Também inserir acesso para clientes `existing` que o usuário ainda não tenha acesso (caso de mapeamento para cliente existente criado por outro usuário)

**Dados existentes:** Corrigir os ~100+ clientes já criados que não têm `user_client_access`, inserindo acesso admin para o usuário atual via migration ou query pontual.

