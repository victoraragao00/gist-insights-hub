# Título do card sem truncar

Trocar `line-clamp-2` por `break-words` no título do `DemandCard.tsx` (linha 87) para que o título quebre em quantas linhas forem necessárias, igual ao card do CX Hub. Como o componente é único, a mudança aplica em CX e TECH automaticamente.

```tsx
<p className="text-sm font-medium leading-snug break-words mb-2 text-foreground">
  {demand.title}
</p>
```
