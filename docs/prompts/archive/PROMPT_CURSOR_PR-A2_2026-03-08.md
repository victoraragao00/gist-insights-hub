Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: fix/dark-mode-shimmer-padding
Prioridade: MEDIA
Depende de: PR-A1 (#39) — JA MERGEADO

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## PR-A2: fix: dark mode tone/status colors, shimmer skeletons, layout padding

### Problema

1. TONE_CONFIG em ClientsPage e ClientDetailPage usa cores light-only (bg-green-100 text-green-700), sem variante dark
2. Skeletons nao usam animate-shimmer (registrado no tailwind.config.ts)
3. DashboardLayout tem padding fixo p-6, sem responsivo p-4 mobile

### Tarefa 1 — TONE_CONFIG dark mode

**Design System 1.1 define os pares:**

| Tom | Light | Dark |
|-----|-------|------|
| ok | text-emerald-600 bg-emerald-50 | dark:text-emerald-400 dark:bg-emerald-950 |
| atencao | text-yellow-600 bg-yellow-50 | dark:text-yellow-400 dark:bg-yellow-950 |
| alerta | text-orange-600 bg-orange-50 | dark:text-orange-400 dark:bg-orange-950 |
| critico | text-red-600 bg-red-50 | dark:text-red-400 dark:bg-red-950 |

**ClientsPage.tsx (linhas ~51-55):**
Atual:
```typescript
const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-green-100 text-green-700" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-100 text-yellow-700" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-100 text-orange-700" },
  critico: { label: "🔴 Crítico", className: "bg-red-100 text-red-700" },
};
```

Novo (conforme Design System):
```typescript
const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  critico: { label: "🔴 Crítico", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
};
```

**ClientDetailPage.tsx (linhas ~108-112):**
Mesmo TONE_CONFIG — aplicar a mesma mudanca.

**ClientDetailPage.tsx — cores inline de tom (linha ~562):**
Atual:
```typescript
ok: "bg-green-500", atencao: "bg-yellow-500", alerta: "bg-orange-500", critico: "bg-red-500",
```
Estas sao barras de progresso — bg-*-500 funciona em ambos os modos. Nao alterar.

**ClientDetailPage.tsx — badges de participante (linhas ~657-658):**
Atual:
```typescript
badgeColor="bg-orange-100 text-orange-700"
badgeColor="bg-blue-100 text-blue-700"
```
Novo:
```typescript
badgeColor="bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
badgeColor="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
```

**ClientDetailPage.tsx — badge "Ativo" (linha ~706):**
Atual:
```typescript
<Badge className="bg-green-100 text-green-700 border-0 text-xs">Ativo</Badge>
```
Novo:
```typescript
<Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border-0 text-xs">Ativo</Badge>
```

### Tarefa 2 — animate-shimmer nos Skeletons

**ClientsPage.tsx (linhas ~211-217):**
Adicionar classe `animate-shimmer` em cada Skeleton:
```tsx
<Skeleton className="h-5 w-40 animate-shimmer" />
```
Aplicar em todos os 6 Skeleton do loading de ClientsPage.

**ClientDetailPage.tsx (linhas ~416-419):**
Mesmo padrao — adicionar `animate-shimmer` em todos os Skeleton (3 itens: h-8, h-4, e os 6 h-24).

### Tarefa 3 — Padding responsivo DashboardLayout

**DashboardLayout.tsx (linha ~42-50):**
Atual:
```tsx
<main className="flex-1 p-6 overflow-auto">
```
Novo:
```tsx
<main className="flex-1 p-4 md:p-6 overflow-auto">
```

### Nao fazer
- Nao tocar em SettingsPage (dark mode do jobStatusBadge ja foi feito no PR-F/#43)
- Nao alterar cores de barras de progresso (bg-*-500 funcionam em ambos os modos)
- Nao alterar logica, queries ou error handling

### CTO Checklist
- m11: zero imports nao usados

### Criterios de aceitacao
- Todas as cores de tom com variante dark conforme Design System 1.1
- Badges de participante e status com dark mode
- Skeletons com animate-shimmer
- DashboardLayout main: p-4 md:p-6
- SettingsPage NAO tocado neste PR
- Zero regressao visual em light mode

### PR
- Titulo: `fix: dark mode tone/status colors, shimmer skeletons, layout padding`
- Branch: `fix/dark-mode-shimmer-padding`
- Arquivos: ClientsPage.tsx, ClientDetailPage.tsx, DashboardLayout.tsx
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO — nao apenas push)
