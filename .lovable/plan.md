
Objetivo: fazer a sync continuar além de 60 contatos e só parar quando acabar paginação real da API (contatos vazios ou sem próxima página), mantendo batch-safe para evitar timeout.

1) Diagnóstico confirmado
- O botão de teste em `/interactions` está chamando com `body: { page: 1, max_pages: 1 }`, então sempre começa da página 1.
- Nos logs da função, `total_pages` aparece `undefined`, então a lógica atual de fallback por `total_pages` é frágil.
- Resultado atual `has_more: false` após 60 contatos indica que a detecção de próxima página no runtime não está robusta para o formato real retornado pela API.

2) Mudanças no backend (`sync-gist-contacts`)
- Reescrever o bloco de paginação para depender de metadados reais da resposta:
  - prioridade 1: `pages.next` (URL da próxima página)
  - prioridade 2: sem `next` => encerrar (`has_more=false`)
  - encerrar também quando `contacts.length === 0`
- Remover qualquer break/return baseado em `last_seen_at` (garantir 100% sem corte por data).
- Manter:
  - retry 429 com 2s
  - delay de 150ms entre páginas
- Garantir `DEFAULT_MAX_PAGES = 50`.
- Ao atingir limite do batch (`pagesProcessed >= maxPages`) e existir próxima página:
  - retornar `has_more=true` e `next_page=<página seguinte>`.

3) Mudanças no frontend para “continuar” de verdade
- Atualizar o fluxo de teste em `InteractionsPage` para loop automático:
  - iniciar `page=1`
  - invocar `sync-gist-contacts`
  - enquanto `result.has_more === true`, chamar novamente com `page=result.next_page`
  - acumular totais e exibir JSON consolidado no `<pre>`
- Resultado: um clique continua a sync em múltiplas invocações, sem ficar travado em apenas 60.

4) Validação
- Validar no console/network:
  - chamadas sequenciais com `page=1,2,3...`
  - `contacts_processed` acumulado > 60
  - final com `has_more=false`
- Conferir logs da função:
  - linhas de `fetching page X` avançando
  - ausência total de condição de parada por data
- Teste de regressão:
  - inativação no fim só roda no último batch (`!has_more`), como esperado.

Se aprovado, implemento exatamente esse ajuste (backend + continuidade no botão de teste) para você conseguir rodar o sync completo de ponta a ponta sem intervenção manual.
