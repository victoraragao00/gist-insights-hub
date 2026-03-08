# PR: feat: filtro de status e badge na ClientsPage

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/client-status-filter`
Prioridade: ALTA
Issue: #55

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

---

## Problema

Todos os pontos do frontend filtram clientes com `.eq("active", true)`. Agora existe uma coluna `status` com 3 valores (`ativo`, `inativo`, `trial`). O filtro default deve ser `.in("status", ["ativo", "trial"])` e o usuario pode ativar um toggle para incluir inativos.

---

## Frontend Contract (do Lovable S7)

```
Coluna: clients.status TEXT NOT NULL DEFAULT 'ativo'
Valores: 'ativo' | 'inativo' | 'trial'

Filtro default: .in("status", ["ativo", "trial"])
Filtro com inativos: sem filtro de status
```

---

## Tarefa 1 — STATUS_CONFIG

Adicionar constante no topo de `ClientsPage.tsx` (ou em arquivo de config compartilhado se preferir):

```tsx
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo: {
    label: "Ativo",
    className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  trial: {
    label: "Trial",
    className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  inativo: {
    label: "Inativo",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};
```

---

## Tarefa 2 — ClientsPage.tsx

### 2.1 Estado do filtro

Adicionar estado para o toggle:

```tsx
const [includeInactive, setIncludeInactive] = useState(false);
```

### 2.2 Alterar query

Substituir `.eq("active", true)` por:

```tsx
let query = supabase
  .from("clients")
  .select("id, name, slug, active, status, channel_bindings(channel, label, active)", { count: "exact" });

if (!includeInactive) {
  query = query.in("status", ["ativo", "trial"]);
}

query = query.order("name").range(from, to);
```

### 2.3 queryKey

Atualizar para incluir o estado do filtro:

```tsx
queryKey: ["clients_list", user?.id, page, includeInactive],
```

### 2.4 Toggle na UI

Acima da lista de clientes, adicionar toggle:

```tsx
<div className="flex items-center gap-2">
  <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
  <span className="text-sm text-muted-foreground">Incluir inativos</span>
</div>
```

### 2.5 Badge de status

Na lista/grid de clientes, ao lado do nome ou dos icones de canal:

```tsx
<span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[client.status]?.className ?? ""}`}>
  {STATUS_CONFIG[client.status]?.label ?? client.status}
</span>
```

### 2.6 Atualizar ClientRow interface

```tsx
interface ClientRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  status: string;  // <-- NOVO
  channel_bindings: Array<{
    channel: string;
    label: string | null;
    active: boolean | null;
  }>;
}
```

---

## Tarefa 3 — SearchPage.tsx

Substituir `.eq("active", true)` (L80) por `.in("status", ["ativo", "trial"])` no dropdown de clientes.

---

## Tarefa 4 — SettingsPage.tsx

Substituir `.eq("active", true)` (L115) por `.in("status", ["ativo", "trial"])` na lista de clientes para prioridade.

---

## Tarefa 5 — GistContactWizard.tsx

Substituir `.eq("active", true)` (L108) por `.in("status", ["ativo", "trial"])` na lista de clientes.

---

## Nao fazer

- Nao remover a coluna `active` das queries (ainda usada para icone de canal)
- Nao alterar ClientDetailPage (sera feito em PR separado)
- Nao alterar backend
- Nao instalar libs adicionais (Switch ja existe em shadcn)

---

## CTO Checklist

- m1: zero `any` — tipar status como string
- m4: staleTime mantido (5min)
- m5: queryKey com includeInactive
- m8: erros Supabase tratados
- m11: zero imports nao usados

---

## Criterios de aceitacao

- Filtro default mostra apenas `ativo` e `trial`
- Toggle "Incluir inativos" mostra todos os clientes
- Badge de status com cores corretas (emerald, blue, slate)
- Dark mode correto em todos os badges
- 4 arquivos atualizados (ClientsPage, SearchPage, SettingsPage, GistContactWizard)
- queryKey inclui estado do filtro
- Zero regressao

---

## PR

- Titulo: `feat: filtro de status e badge na ClientsPage`
- Branch: `feat/client-status-filter`
- Arquivos: ClientsPage.tsx, SearchPage.tsx, SettingsPage.tsx, GistContactWizard.tsx
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
