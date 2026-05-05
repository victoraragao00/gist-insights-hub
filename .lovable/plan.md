## Hotfix — largura do card no swimlane TECH

Três ajustes pontuais de CSS/layout. Sem mudanças de lógica.

### 1. `src/components/demands/DemandCard.tsx` (linha 87)

Reaplicar `line-clamp-2` junto com `break-words` no título, para que títulos longos quebrem em até 2 linhas com reticências em ambos os contextos (CX e TECH):

```tsx
<p className="text-sm font-medium leading-snug line-clamp-2 break-words mb-2 text-foreground">
  {demand.title}
</p>
```

### 2. `src/components/demands/TechSwimlanePage.tsx` — grid template

Trocar `minmax(280px, 1fr)` por `300px` fixo no `gridTemplate`, para todas as colunas expandidas terem a mesma largura (e o card não esticar com a tela):

```ts
const gridTemplate = useMemo(
  () =>
    `180px ${columns
      .map((c) => (isCollapsed(c.id) ? "48px" : "300px"))
      .join(" ")}`,
  [columns, isCollapsed]
);
```

### 3. `SwimlaneCell` (mesmo arquivo) — limitar largura do card

Envelopar cada `DraggableDemandCard` em um wrapper `max-w-[280px]`:

```tsx
{demands.map((d) => (
  <div key={d.id} className="max-w-[280px]">
    <DraggableDemandCard
      demand={d}
      onClick={() => onCardClick(d)}
      taskCounts={taskCounts}
    />
  </div>
))}
```

(Removendo o `key` do componente interno para evitar duplicação.)

### Notas

- CX Kanban (`KanbanColumn`) não é tocado — largura preservada.
- Nenhum import novo é necessário; nada deixa de ser usado (m11 ok).
- Arquivos protegidos não são tocados.

### Verificação

1. TECH: cards com ~280px, colunas todas iguais.
2. Título longo: 2 linhas + reticências.
3. CX: sem alteração visual.
