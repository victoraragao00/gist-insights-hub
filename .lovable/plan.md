## Escopo

3 fixes de UX em páginas de detalhe e no item de subdemanda. Sem migration, sem mudança de banco. Apenas frontend.

## Contexto técnico relevante

- `DashboardLayout` tem `<main className="flex-1 min-h-0 overflow-hidden">` → cada página precisa controlar seu próprio scroll interno.
- Hoje `DemandDetailPage` usa `max-w-6xl mx-auto p-6 space-y-6` (sem `h-full` nem `overflow-y-auto`) → conteúdo é cortado.
- `AgendaDetailPage` idem: container `max-w-4xl mx-auto space-y-6`.
- Rota `/tasks/:id` já existe (`TaskDetailPage`).
- `DemandTaskItem` em `DemandTasksSection.tsx` é o componente a redesenhar — atualmente usa input direto no título e não navega.

## FIX 1 — Scroll vertical

**`src/pages/DemandDetailPage.tsx`**
- Trocar root para `flex h-full overflow-hidden`.
- Coluna esquerda (header + tabs + conteúdo): `flex-1 min-w-0 overflow-y-auto` com padding interno `p-6 space-y-6 max-w-5xl mx-auto`.
- Manter `DemandSidebar` na lateral direita; envolver em wrapper `w-[300px] shrink-0 border-l border-border overflow-y-auto` (em telas `lg`); em mobile vira bloco abaixo (sem split). Hoje a sidebar já é `lg:w-[280px]` — apenas adicionar overflow independente.

**`src/pages/AgendaDetailPage.tsx`**
- Root: `flex flex-col h-full overflow-hidden`.
- Adicionar wrapper de scroll `flex-1 overflow-y-auto`.
- Manter breadcrumb dentro do scroll (não há header sticky obrigatório no spec — manter simples). Padding `px-6 py-4 max-w-4xl mx-auto` dentro do container scrollável.

## FIX 2 + 3 + 4 — Redesign do item de subdemanda

**`src/components/demands/detail/DemandTasksSection.tsx`** — refatorar `DemandTaskItem` (mantém props/contrato com `DemandTasksSection`).

Mudanças no item:
1. Título vira `<span>` clicável → `navigate(/tasks/${task.id})`. Aplicar `cursor-pointer hover:text-primary`. Riscado quando `done`.
2. `TaskStatusSelect` (novo subcomponente local) — pill arredondada com `Select` shadcn:
   - `open`: muted, `Circle`
   - `in_progress`: azul, `CircleDot`
   - `done`: emerald, `CheckCircle2`
   - Cada opção do dropdown destaca o item selecionado com bg da cor.
3. Cor de fundo do item conforme status:
   - `open`: `bg-card`
   - `in_progress`: `bg-blue-50/30 dark:bg-blue-950/10`
   - `done`: `bg-muted/20` + título riscado.
4. `HoursField` (novo subcomponente local):
   - Label pequena ("Planejado" / "Realizado") + valor com `h`.
   - Click → input inline; Enter salva; Escape cancela; blur salva.
   - "Planejado" grava em `hours_estimated` via `onUpdate`.
   - "Realizado" usa `task.hours_actual` (já vem de `useDemandTasks`); ao salvar manualmente, chama `addManualEntry` via `useAddManualTimeEntry` se existir; caso não exista, mantém edição direta de `hours_actual` via `onUpdate({ hours_actual })` (mesma rota que existe hoje).
5. Hover actions à direita (opacidade 0 → 100):
   - `ExternalLink` icon → `navigate(/tasks/${task.id})`.
   - `Trash2` → `onDelete()`.
6. `stopPropagation` em status select, assignee select e hours fields para não disparar navegação.
7. `AssigneeSelect` compacto: manter `<select>` nativo atual (já compacto) ou trocar por trigger pequeno; manter o atual para reduzir escopo, apenas envolto em `onClick stopPropagation`.

Imports a remover de `DemandTasksSection.tsx`: `Check` (se não mais usado pelo item após redesign — verificar uso restante no progress bar; lá ainda usa, manter). Adicionar: `Circle`, `CircleDot`, `CheckCircle2`, `ExternalLink`, `useNavigate`, componentes `Select*` do shadcn.

## Verificação manual pós-edição

1. Demanda aberta → painel esquerdo rola; sidebar rola independentemente.
2. Pauta aberta → conteúdo rola dentro do main.
3. Subdemanda: clicar título e ícone ↗ → vai para `/tasks/:id`.
4. Status select muda cor de fundo do item.
5. "Planejado" e "Realizado" editam inline com Enter.
6. `m11`: `npm run build` (harness) sem warnings de imports.

## Arquivos editados

- `src/pages/DemandDetailPage.tsx`
- `src/pages/AgendaDetailPage.tsx`
- `src/components/demands/detail/DemandTasksSection.tsx`

Nenhum arquivo proibido tocado. Nenhuma migration.
