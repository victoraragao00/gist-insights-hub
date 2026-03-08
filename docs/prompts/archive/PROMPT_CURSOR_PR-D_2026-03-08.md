Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: fix/audits-empty-state
Prioridade: ALTA

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## PR-D: fix: honest empty state for Audits page

### Problema

Audits.tsx (39 linhas) mostra um botao "Criar primeira auditoria" que nao faz nada.
A Edge Function evaluate-audit-rules ainda nao existe (Issue #38, pendente).
O botao cria expectativa falsa.

### Tarefas

1. Remover o `<Button>` "Criar primeira auditoria" (e o import de Plus se ficar sem uso)
2. Alterar o texto para ser honesto sobre o estado:

```tsx
<h3 className="text-lg font-semibold">Auditorias em breve</h3>
<p className="text-muted-foreground mt-1 max-w-md">
  O sistema de alertas automaticos esta em desenvolvimento.
  Voce sera notificado quando regras de auditoria estiverem disponiveis.
</p>
```

3. Manter o icone ShieldAlert e a estrutura do Card

### Nao fazer
- Nao adicionar queries ou hooks (nao ha dados ainda)
- Nao alterar o layout do DashboardLayout

### CTO Checklist
- m11: zero imports nao usados (remover Plus e Button se nao usados)

### Criterios de aceitacao
- Pagina Auditorias mostra mensagem honesta sem botao enganoso
- Zero imports nao usados

### PR
- Titulo: `fix: honest empty state for Audits page`
- Branch: `fix/audits-empty-state`
- Arquivos: Audits.tsx
