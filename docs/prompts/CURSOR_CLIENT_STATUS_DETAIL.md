# PR: feat: badge de status no ClientDetailPage

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/client-status-detail-badge`
Prioridade: MEDIA
Issue: #56

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

---

## Problema

A pagina de detalhe do cliente nao mostra o status (`ativo`, `inativo`, `trial`). O usuario precisa saber visualmente a situacao do cliente, especialmente quando o cliente esta inativo.

---

## Frontend Contract (do Lovable S7)

```
Coluna: clients.status TEXT NOT NULL DEFAULT 'ativo'
Valores: 'ativo' | 'inativo' | 'trial'
```

---

## Tarefa 1 — Badge de status

Em `ClientDetailPage.tsx`, adicionar badge ao lado do nome do cliente:

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

Ao lado do `<h1>` com o nome do cliente:

```tsx
<span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[client.status]?.className ?? ""}`}>
  {STATUS_CONFIG[client.status]?.label ?? client.status}
</span>
```

---

## Tarefa 2 — Banner informativo para inativos

Se `client.status === "inativo"`, renderizar banner abaixo do cabecalho:

```tsx
{client.status === "inativo" && (
  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
    Este cliente está inativo. Interações continuam sendo processadas normalmente.
  </div>
)}
```

---

## Tarefa 3 — Atualizar select da query

Adicionar `status` ao select se nao estiver presente:

```tsx
.select("id, name, slug, active, status, metadata, created_at")
```

Atualizar a interface `ClientDetail` para incluir `status: string`.

---

## Nao fazer

- Nao bloquear acesso a pagina de clientes inativos
- Nao alterar graficos ou metricas
- Nao alterar filtros (feito no PR de filtro)
- Nao alterar backend

---

## CTO Checklist

- m1: zero `any`
- m8: erros Supabase tratados
- m11: zero imports nao usados

---

## Criterios de aceitacao

- Badge de status visivel ao lado do nome do cliente
- Cores corretas: ativo=verde, trial=azul, inativo=cinza
- Banner informativo para clientes inativos
- Dark mode correto
- Zero regressao

---

## PR

- Titulo: `feat: badge de status no ClientDetailPage`
- Branch: `feat/client-status-detail-badge`
- Arquivos: ClientDetailPage.tsx
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
