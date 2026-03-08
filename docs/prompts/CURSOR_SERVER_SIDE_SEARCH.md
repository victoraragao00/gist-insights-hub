# PR: fix: busca server-side em ClientsPage, SearchPage e Dashboard

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `fix/server-side-search`
Prioridade: ALTA
Issue: #63

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

---

## Problema

A busca em ClientsPage e Dashboard aplica `.filter()` client-side no array JavaScript local. Isso ignora registros em outras paginas. Exemplo: buscar "reserva" em `/clients` nao encontra "reserva.ink" se estiver na pagina 2.

A SearchPage busca apenas interacoes — nao retorna clientes cujo nome corresponde ao termo.

---

## Tarefa 1 — Hook useDebounce (novo)

Criar `src/hooks/useDebounce.ts`:

```tsx
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

---

## Tarefa 2 — ClientsPage.tsx: busca server-side

### 2.1 Adicionar debounce ao search

```tsx
import { useDebounce } from "@/hooks/useDebounce";

// Estado existente:
const [search, setSearch] = useState("");

// Novo:
const debouncedSearch = useDebounce(search.trim(), 300);
```

### 2.2 Reset paginacao ao buscar

```tsx
useEffect(() => {
  setPage(0);
}, [debouncedSearch]);
```

### 2.3 Modificar query Supabase

Substituir a query atual. Onde esta:

```tsx
let query = supabase
  .from("clients")
  .select("id, name, slug, active, status, channel_bindings(channel, label, active)", { count: "exact" });
if (!includeInactive) {
  query = query.in("status", ["ativo", "trial"]);
}
const { data, error, count } = await query.order("name").range(from, to);
```

Substituir por:

```tsx
let query = supabase
  .from("clients")
  .select("id, name, slug, active, status, channel_bindings(channel, label, active)", { count: "exact" });
if (!includeInactive) {
  query = query.in("status", ["ativo", "trial"]);
}
if (debouncedSearch.length >= 3) {
  query = query.ilike("name", `%${debouncedSearch}%`);
}
const { data, error, count } = await query.order("name").range(from, to);
```

### 2.4 Atualizar queryKey

```tsx
queryKey: ["clients_list", user?.id, page, includeInactive, debouncedSearch],
```

### 2.5 Atualizar staleTime

```tsx
staleTime: debouncedSearch.length >= 3 ? 30_000 : 5 * 60_000,
```

### 2.6 Remover filter client-side do useMemo

No `useMemo` que cria `clientsWithStats`, **remover** a linha de `.filter()` por search:

Onde esta algo como:
```tsx
.filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
```

Remover essa linha. O filtro agora e server-side. O `useMemo` continua existindo para merge com `statsMap`/`scoreMap` e sorting — apenas o `.filter()` por busca sai.

Remover tambem a variavel `q`:
```tsx
const q = search.toLowerCase().trim();  // <-- REMOVER
```

### 2.7 Empty state para busca

Onde esta o empty state atual, ajustar:

```tsx
{!clientsError && clientsWithStats.length === 0 ? (
  <div className="py-20 text-center text-muted-foreground text-sm">
    {debouncedSearch.length >= 3
      ? `Nenhum cliente encontrado para "${debouncedSearch}"`
      : includeInactive
        ? "Adicione um cliente para começar."
        : "Nenhum cliente encontrado. Ative \"Incluir inativos\" para ver todos."}
  </div>
) : ( ... )}
```

---

## Tarefa 3 — SearchPage.tsx: adicionar busca de clientes

### 3.1 Substituir debounce inline pelo hook

**Remover** toda a implementacao inline de debounce:
- A variavel `debounceRef` (useRef)
- O `useEffect` que faz `setTimeout` + `clearTimeout` para setar `debouncedQuery`

**Substituir por:**

```tsx
import { useDebounce } from "@/hooks/useDebounce";

const debouncedQuery = useDebounce(inputValue.trim(), 300);
```

Manter o `useEffect` que reseta `page` para 0, mas mudar a dependencia para `debouncedQuery`:

```tsx
useEffect(() => {
  setPage(0);
}, [debouncedQuery]);
```

**Remover** o import de `useRef` se nao for mais usado em nenhum outro lugar do arquivo.

### 3.2 Adicionar query de clientes

```tsx
const { data: clientMatches = [] } = useQuery<Array<{ id: string; name: string; slug: string; status: string }>>({
  queryKey: ["client-search", debouncedQuery],
  enabled: debouncedQuery.length >= 3,
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, slug, status")
      .ilike("name", `%${debouncedQuery}%`)
      .in("status", ["ativo", "trial"])
      .order("name")
      .limit(5);
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; name: string; slug: string; status: string }>;
  },
});
```

### 3.3 Exibir secao "Clientes" acima de "Interacoes"

Quando `showResults` e true e `clientMatches.length > 0`, renderizar antes da tabela de interacoes:

```tsx
{showResults && clientMatches.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-foreground">Clientes</h3>
    <div className="grid gap-2">
      {clientMatches.map((c) => (
        <Link
          key={c.id}
          to={`/clients/${c.slug}`}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-shadow duration-200 hover:shadow-md"
        >
          <div>
            <span className="font-medium text-sm text-foreground">{c.name}</span>
            <p className="text-xs text-muted-foreground">{c.slug}</p>
          </div>
          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
            c.status === "ativo"
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
              : c.status === "trial"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}>
            {c.status === "ativo" ? "Ativo" : c.status === "trial" ? "Trial" : "Inativo"}
          </span>
        </Link>
      ))}
    </div>
    <hr className="border-border" />
  </div>
)}
```

**Importar Link:**
```tsx
import { Link } from "react-router-dom";
```

Se nao houver resultados de clientes, a secao simplesmente nao renderiza (sem empty state para ela).

### 3.4 Renomear secao de interacoes (opcional mas recomendado)

Adicionar titulo "Interacoes" acima da tabela existente para diferenciar das duas secoes:

```tsx
{showResults && (
  <h3 className="text-sm font-semibold text-foreground">Interações</h3>
)}
```

---

## Tarefa 4 — Index.tsx (Dashboard): adicionar debounce

### 4.1 Importar e usar useDebounce

```tsx
import { useDebounce } from "@/hooks/useDebounce";

const debouncedSearch = useDebounce(search.trim(), 300);
```

### 4.2 Atualizar useMemo

No `useMemo` que cria `filteredList`, substituir `search` por `debouncedSearch`:

Onde esta:
```tsx
if (search.trim()) {
  const q = search.toLowerCase().trim();
  result = result.filter((r) => r.client_name.toLowerCase().includes(q));
}
```

Substituir por:
```tsx
if (debouncedSearch.length >= 3) {
  const q = debouncedSearch.toLowerCase();
  result = result.filter((r) => r.client_name.toLowerCase().includes(q));
}
```

**NOTA:** mantemos client-side filtering aqui porque o Dashboard carrega ~13 clientes via `usePriorityScores()`. Server-side nao e necessario para esse volume. O debounce evita re-renders desnecessarios.

### 4.3 Atualizar dependencias do useMemo

```tsx
}, [list, debouncedSearch, tierFilter]);
```

---

## Nao fazer

- Nao modificar `usePriorityScores` — o hook e compartilhado e o volume (~13 clientes) nao justifica server-side
- Nao alterar `useSearchInteractions` — a busca de interacoes ja e server-side e esta correta
- Nao alterar backend
- Nao tocar em `src/integrations/supabase/*`
- Nao instalar libs de debounce (lodash, etc.) — usar o hook proprio

---

## CTO Checklist

- m1: zero `any` — tipar useDebounce com generic `<T>`
- m3: toast sonner se erro em busca de clientes
- m4: staleTime 30s em queries com filtro, 5min sem filtro
- m5: queryKey com debouncedSearch em ClientsPage + client-search no SearchPage
- m7: debounce 300ms como guard contra chamadas duplas
- m8: erros Supabase destructurados em query de clientes no SearchPage
- m11: remover useRef de SearchPage se nao mais usado, remover variavel `q` de ClientsPage
- m12: reset page=0 ao buscar (ClientsPage e SearchPage)

---

## Criterios de aceitacao

- ClientsPage: buscar "reserva" encontra clientes em qualquer pagina
- ClientsPage: debounce 300ms (verificar no Network — 1 chamada apos parar de digitar)
- ClientsPage: menos de 3 chars mostra lista normal
- ClientsPage: busca reseta para pagina 1
- ClientsPage: empty state "Nenhum cliente encontrado para '[termo]'"
- SearchPage: buscar "reserva" mostra secao "Clientes" acima de "Interacoes"
- SearchPage: busca sem match de cliente omite secao "Clientes"
- SearchPage: debounce inline substituido pelo hook useDebounce
- Dashboard: debounce 300ms no filtro de nome
- Dashboard: filtro so aplica com 3+ chars
- Dark mode correto nos cards de clientes do SearchPage
- Zero regressao na paginacao, filtros de status e sorting

---

## PR

- Titulo: `fix: busca server-side em ClientsPage, SearchPage e Dashboard`
- Branch: `fix/server-side-search`
- Arquivos: useDebounce.ts (novo), ClientsPage.tsx, SearchPage.tsx, Index.tsx
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
