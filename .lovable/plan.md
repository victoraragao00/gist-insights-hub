

# Armazenamento Seguro da API Key do Gist

A chave **nunca** ficará visível no código, no frontend ou em arquivos do projeto. Ela será armazenada como um **secret seguro no backend**, acessível apenas pelas funções de servidor (Edge Functions).

## O que será feito

### 1. Salvar a chave como Secret do backend
- A chave será armazenada como `GIST_API_KEY` nos secrets do projeto
- Ela **não** aparece em nenhum arquivo, `.env`, ou código-fonte
- Só pode ser lida por Edge Functions no servidor

### 2. Criar Edge Function `gist-proxy`
- Arquivo: `supabase/functions/gist-proxy/index.ts`
- Lê a `GIST_API_KEY` via `Deno.env.get('GIST_API_KEY')`
- Recebe do frontend apenas o endpoint desejado (ex: `/contacts`)
- Faz a chamada à API do Gist (`https://api.getgist.com/`) no servidor
- Retorna os dados ao frontend sem expor a chave
- CORS configurado, `verify_jwt = false` no config.toml

### 3. UI de teste no frontend
- Botão "Testar Conexão" no card do Gist na página de Integrações
- Chama `supabase.functions.invoke('gist-proxy', { body: { endpoint: 'contacts' } })`
- Exibe dados retornados para validar que a integração funciona

## Segurança garantida
- A chave existe **apenas** nos secrets do backend
- O frontend **nunca** tem acesso direto à chave
- Toda comunicação com a API do Gist passa pela Edge Function no servidor

