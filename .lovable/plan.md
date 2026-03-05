

## Diagnóstico e plano de otimização

### Problemas encontrados

**1. Bug de progresso: denominador incompatível (contatos)**

No loop de contatos, `pageCount` conta **invocações** (cada uma processa 5 páginas), mas `denominator` é `total_pages` (páginas individuais, ~31). Resultado: após 6 invocações (cobrindo ~30 páginas), o progresso mostra `6/31 ≈ 19%` quando na verdade ~97% das páginas foram processadas. Com `totalSteps=3`, isso vira ~6% da barra total. Explica o que você vê.

**Correção:** usar `page` (página acumulada) ao invés de `pageCount` (invocações) no cálculo de subProgress:
```
subProgress = Math.min(page / denominator, 0.95)
```

**2. Bug grave: `ingest-gist-historical` ignora `client_id`**

A edge function **não aceita** o parâmetro `client_id`. Ela sempre busca TODAS as conversas do Gist globalmente. O frontend passa `client_id` no body, mas o backend ignora. Com 2 clientes selecionados, o histórico completo é processado **2 vezes**.

**Correção:** Chamar `ingest-gist-historical` apenas **uma vez** (não por cliente). Remover o loop `for (const client of selectedClients)` e fazer uma única passagem global. A resolução de client_id já acontece no backend via mapeamento de participantes.

**3. Denominador do histórico fixo em 5 é incorreto**

O denominador 5 assume que serão exatamente 5 invocações. Na realidade, pode haver centenas de páginas de conversas. A função retorna `totalPagesCount` no resultado — devemos usar isso como denominador, similar ao contacts.

### Plano de implementação

#### `src/context/ClientContext.tsx`

1. **Contacts loop** — trocar `pageCount / denominator` por `page / denominator` (onde `page` é a página acumulada real)

2. **History loop** — remover o `for` por cliente. Fazer uma única chamada em loop:
   - Step 1 (se contacts): sync contatos global
   - Step 2 (se history): sync histórico global (1 passagem)
   - `totalSteps` = contactsStep + (syncHistory ? 1 : 0)
   - Usar `totalPagesCount` retornado pela função como denominador dinâmico (default 50)

3. **Resultados** — ao final do history, reportar um único resultado global com total de mensagens inseridas

#### Sem alterações nas edge functions

As funções já funcionam corretamente — o problema está na orquestração do frontend.

### Impacto

- Tempo de sync com 2 clientes: de ~2x o tempo total para ~1x
- Barra de progresso: reflete progresso real ao invés de ficar parada em <5%
- Nenhuma alteração nas edge functions = sem risco para a sync em andamento

