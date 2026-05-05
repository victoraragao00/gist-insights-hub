## Problema

Ao abrir um projeto, a página crasha com **React error #310** ("Rendered more hooks than during the previous render").

A causa é uma violação das Rules of Hooks em `src/pages/ProjectDetailPage.tsx`:

- Linhas 57-70: dois early returns (`if (isLoading)` e `if (!project || !id)`).
- Linha 79: `const { data: projectAgendas = [] } = useProjectAgendas(id);` — um hook chamado **depois** dos early returns.

Na primeira render (enquanto carrega) o React registra N hooks; quando `project` chega, passa a registrar N+1 hooks → crash.

## Correção

Mover a chamada do hook `useProjectAgendas(id)` para **antes** dos early returns, junto com os outros hooks (`useProject`, `useProjectStats`, `useUpdateProject`, `useCancelProject`).

```text
useProject(id)          ← já está no topo
useProjectStats(id)     ← já está no topo
useUpdateProject()      ← já está no topo
useCancelProject()      ← já está no topo
useProjectAgendas(id)   ← MOVER PARA AQUI (antes dos if isLoading / !project)
useState(...)           ← mantém
useEffect(...)          ← mantém
```

O hook `useProjectAgendas` já tem `enabled: !!id && !!user?.id` internamente (padrão do projeto), então chamá-lo cedo com `id` possivelmente undefined é seguro.

## Arquivo afetado

- `src/pages/ProjectDetailPage.tsx` — reordenar a linha 79 para antes do bloco `if (isLoading)` (linha 57).

## Fora de escopo (para tratar depois, se quiser)

- O erro "Não foi possível carregar o Dashboard TECH" em `/tech/dashboard` é um problema separado (RPC `get_tech_dashboard_metrics` falhando). Posso investigar em seguida se quiser — me avise.
