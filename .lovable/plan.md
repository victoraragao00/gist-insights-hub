

# Integração Gist — Puxar Dados via API

## Pré-requisito: GIST_API_KEY
Precisamos armazenar a API Key do Gist como secret no backend. Vou solicitar que você insira sua chave (encontrada em Gist > Settings > API Key).

## O que será implementado

### 1. Edge Function `gist-proxy`
Uma função backend que recebe o endpoint desejado e faz a chamada à API do Gist (`https://api.getgist.com/`) usando Bearer token com a secret `GIST_API_KEY`.

Endpoints suportados inicialmente:
- `/contacts` — lista contatos
- `/conversations` — lista conversas
- `/campaigns` — lista campanhas
- `/tags` — lista tags
- `/segments` — lista segmentos
- `/teammates` — lista teammates
- `/token` — info do workspace

Rate limit respeitado (100 req/10s). A função aceita `endpoint` e `params` como parâmetros.

### 2. Página de teste Gist
Criar uma página ou seção dentro de Integrações onde, ao clicar em "Testar Conexão" no card do Gist, a função é chamada com `/token` para validar a API key e exibir os dados do workspace. Em seguida, permitir explorar os endpoints (contatos, conversas, campanhas) com dados reais exibidos em tabelas.

### 3. Fluxo
1. Solicitar secret `GIST_API_KEY`
2. Criar edge function `gist-proxy` com CORS, validação de secret, proxy para `api.getgist.com`
3. Criar UI de teste no frontend para chamar a edge function e exibir dados reais do Gist
4. Validar que os dados chegam corretamente

## Detalhes técnicos

- **Auth da API Gist**: `Authorization: Bearer <GIST_API_KEY>` header
- **Base URL**: `https://api.getgist.com/`
- **Edge function**: `supabase/functions/gist-proxy/index.ts` com `verify_jwt = false`
- **Frontend**: chama via `supabase.functions.invoke('gist-proxy', { body: { endpoint, params } })`

