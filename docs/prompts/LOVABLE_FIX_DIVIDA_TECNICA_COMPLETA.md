# LOVABLE — Dívida Técnica Completa (DT-1)
# CX Hub uMode — 2026-03-26
# Repo: https://github.com/HyTrackWater/gist-insights-hub
# Supabase project: qyfwbmukylyfsgzgocfo

---

Leia CONTEXT.md, AGENTS.md e docs/DESIGN_SYSTEM.md antes de iniciar.

---

## OBRIGATÓRIO

1. Migrations via migration tool — nunca DDL manual
2. Seguir docs/DESIGN_SYSTEM.md em todas as decisões visuais
3. `useMutation` para toda operação de escrita (m9)
4. `sonner` para toasts — nunca `use-toast` (m3)
5. Erros Supabase sempre tratados — `{ data, error }` destructurado (m8)
6. Não alterar lógica de negócio — apenas refatorar tipagem, imports e visual

## PROIBIDO

1. Tocar em `src/integrations/supabase/*`, `supabase/config.toml`, `.env`
2. Alterar Edge Functions (já auditadas e corrigidas)
3. Alterar lógica de queries, mutations ou fluxos — apenas trocar tipos e imports
4. Adicionar features novas
5. Tomar decisões autônomas sobre o que corrigir — seguir EXATAMENTE esta lista

---

## BLOCO 1 — Paleta de Cores Centralizada (DS1, DS2, DSb1, O2)

### Passo 1: Criar arquivo `src/lib/colorPalette.ts`

```typescript
// src/lib/colorPalette.ts
// Fonte única de verdade para cores semânticas — usado em charts, badges e componentes

// ── Tom (classificação IA) ──
export const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  critico: { label: "🔴 Crítico", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
};

// ── Tom para Recharts (HSL) ──
export const TONE_CHART_COLORS: Record<string, string> = {
  ok: "hsl(160, 84%, 39%)",
  atencao: "hsl(48, 96%, 53%)",
  alerta: "hsl(25, 95%, 53%)",
  critico: "hsl(0, 84%, 60%)",
};

// ── Tom para barras de distribuição (bg-*) ──
export const TONE_BAR_COLORS: Record<string, string> = {
  ok: "bg-emerald-500",
  atencao: "bg-yellow-500",
  alerta: "bg-orange-500",
  critico: "bg-red-500",
};

// ── Prioridade para Recharts ──
export const PRIORITY_CHART_COLORS: Record<string, string> = {
  urgent: "hsl(0, 84%, 60%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(48, 96%, 53%)",
  low: "hsl(160, 84%, 39%)",
};

// ── Score buckets para Recharts ──
export const SCORE_BUCKET_COLORS = [
  { name: "0-39", fill: "hsl(160, 84%, 39%)" },
  { name: "40-59", fill: "hsl(48, 96%, 53%)" },
  { name: "60-79", fill: "hsl(25, 95%, 53%)" },
  { name: "80+", fill: "hsl(0, 84%, 60%)" },
];

// ── Satisfação (1-5) ──
export const SATISFACTION_CONFIG = [
  { value: 1, emoji: "😡", label: "Muito insatisfeito", color: "text-red-500 hover:text-red-600" },
  { value: 2, emoji: "😟", label: "Insatisfeito", color: "text-orange-500 hover:text-orange-600" },
  { value: 3, emoji: "😐", label: "Neutro", color: "text-yellow-500 hover:text-yellow-600" },
  { value: 4, emoji: "🙂", label: "Satisfeito", color: "text-emerald-500 hover:text-emerald-600" },
  { value: 5, emoji: "😍", label: "Muito satisfeito", color: "text-emerald-600 hover:text-emerald-700" },
];
```

### Passo 2: Substituir TONE_CONFIG duplicado em 3 páginas

**src/pages/ClientDetailPage.tsx** — Remover linhas ~123-128 (definição local de TONE_CONFIG). Adicionar no topo:
```typescript
import { TONE_CONFIG, TONE_CHART_COLORS, TONE_BAR_COLORS } from "@/lib/colorPalette";
```
- Linha ~670: substituir HSL hardcoded do chart config por `TONE_CHART_COLORS`:
  ```typescript
  config={{
    ok: { label: "Ok", color: TONE_CHART_COLORS.ok },
    atencao: { label: "Atenção", color: TONE_CHART_COLORS.atencao },
    alerta: { label: "Alerta", color: TONE_CHART_COLORS.alerta },
    critico: { label: "Crítico", color: TONE_CHART_COLORS.critico },
  }}
  ```
- Linha ~700: substituir `bg-green-500` por `TONE_BAR_COLORS`:
  ```typescript
  const colors = TONE_BAR_COLORS;
  ```

**src/pages/ClientsPage.tsx** — Remover definição local de TONE_CONFIG (~linha 71). Importar de `@/lib/colorPalette`.

**src/pages/SearchPage.tsx** — Remover definição local de TONE_CONFIG (~linha 35). Importar de `@/lib/colorPalette`.

### Passo 3: Substituir PRIORITY_COLORS em DemandsDashboardPage

**src/pages/DemandsDashboardPage.tsx** — Remover linhas 26-31 (PRIORITY_COLORS). Importar:
```typescript
import { PRIORITY_CHART_COLORS } from "@/lib/colorPalette";
```
Renomear referências de `PRIORITY_COLORS` para `PRIORITY_CHART_COLORS`.

### Passo 4: Substituir score buckets em Index.tsx

**src/pages/Index.tsx** — Linhas ~130-134. Importar `SCORE_BUCKET_COLORS` e `TONE_CHART_COLORS`:
```typescript
import { SCORE_BUCKET_COLORS, TONE_CHART_COLORS } from "@/lib/colorPalette";
```
Substituir o array hardcoded:
```typescript
return SCORE_BUCKET_COLORS.map(bucket => ({
  ...bucket,
  value: buckets[bucket.name === "80+" ? "critico" : bucket.name === "60-79" ? "alerta" : bucket.name === "40-59" ? "atencao" : "ok"],
}));
```

### Passo 5: SatisfactionPicker usa paleta centralizada

**src/components/agendas/SatisfactionPicker.tsx** — Remover o array `SATISFACTION_OPTIONS` local. Importar:
```typescript
import { SATISFACTION_CONFIG } from "@/lib/colorPalette";
```
Usar `SATISFACTION_CONFIG` no lugar de `SATISFACTION_OPTIONS`.

---

## BLOCO 2 — Remover `as unknown as` dos hooks (M1a — 10 ocorrências)

Para cada hook, substituir o double-cast por cast simples. O Supabase retorna tipo genérico que é compatível com cast direto — o `unknown` intermediário é desnecessário.

| Arquivo | Linha | Antes | Depois |
|---------|-------|-------|--------|
| `src/hooks/useDemands.ts` | 87 | `(data as unknown) as DemandRow[]` | `data as DemandRow[]` |
| `src/hooks/useClientDemands.ts` | 35 | `(data ?? []) as unknown as ClientDemand[]` | `(data ?? []) as ClientDemand[]` |
| `src/hooks/useDemandAnalytics.ts` | 53 | `data as unknown as DemandAnalyticsData` | `data as DemandAnalyticsData` |
| `src/hooks/useDemandInteractions.ts` | 56 | `(data ?? []) as unknown as LinkedInteraction[]` | `(data ?? []) as LinkedInteraction[]` |
| `src/hooks/useMeetingAgendas.ts` | 49 | `(data ?? []) as unknown as MeetingAgendaWithClient[]` | `(data ?? []) as MeetingAgendaWithClient[]` |
| `src/hooks/useMeetingAgendas.ts` | 68 | `data as unknown as MeetingAgenda \| null` | `data as MeetingAgenda \| null` |
| `src/hooks/useMeetingHomework.ts` | 33 | `(data ?? []) as unknown as HomeworkItem[]` | `(data ?? []) as HomeworkItem[]` |
| `src/components/demands/ColumnSettingsTab.tsx` | 166 | `(err as unknown as ColumnHasTicketsError).code` | `(err as ColumnHasTicketsError).code` |
| `src/components/demands/ColumnSettingsTab.tsx` | 167 | `(err as unknown as ColumnHasTicketsError).count` | `(err as ColumnHasTicketsError).count` |
| `src/pages/ClientDetailPage.tsx` | 329 | `(clientDemands as unknown as DemandRow[])` | `(clientDemands as DemandRow[])` |

Se o TypeScript reclamar em algum cast direto (ex: ColumnSettingsTab err), manter `as unknown as` APENAS nesse caso e reportar.

---

## BLOCO 3 — GistContactWizard: useState → useMutation (M9a)

**Arquivo:** `src/components/GistContactWizard.tsx`

Substituir o padrão `setSaving(true/false)` por `useMutation`:

1. Remover `const [saving, setSaving] = useState(false);`
2. Adicionar mutation:
```typescript
const saveMutation = useMutation({
  mutationFn: async ({ mappings, teammates }: { mappings: MappingItem[]; teammates: TeammateItem[] }) => {
    const { data, error } = await supabase.functions.invoke("gist-confirm-mapping", {
      body: { mappings, teammates },
    });
    if (error) throw error;
    return data as { participants_created: number; clients_created: number } | null;
  },
  onSuccess: (result) => {
    toast.success(`Mapeamento salvo! ${result?.clients_created ?? 0} clientes, ${result?.participants_created ?? 0} participantes`);
    // invalidar queries relevantes
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : "Erro ao salvar mapeamento");
  },
});
```
3. Substituir `handleSave` por chamada à mutation: `saveMutation.mutate({ mappings, teammates })`
4. Substituir `saving` por `saveMutation.isPending` em `disabled={!confirmed || saveMutation.isPending}`

---

## BLOCO 4 — Imports não usados (M11b)

| Arquivo | Remover |
|---------|---------|
| `src/pages/AgendasPage.tsx:2` | `import { useQuery } from "@tanstack/react-query";` — remover linha inteira |
| `src/components/agendas/CreateAgendaDialog.tsx:2` | `import { useQuery } from "@tanstack/react-query";` — remover linha inteira |

---

## BLOCO 5 — Skeleton shimmer (DS4)

**Arquivo:** `src/components/ui/skeleton.tsx`

Substituir:
```typescript
return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
```
Por:
```typescript
return <div className={cn("animate-shimmer rounded-md bg-muted", className)} {...props} />;
```

Nota: `animate-shimmer` já está registrado em `tailwind.config.ts`.

---

## BLOCO 6 — Stagger animation (DSb2)

**Arquivo:** `src/pages/AgendasPage.tsx:75`

O `style={{ animationDelay: ..., opacity: 0 }}` não tem classe de animação — itens ficam invisíveis.

Adicionar classe `animate-fade-in-up` ao Card:
```typescript
className="cursor-pointer transition-shadow duration-200 hover:shadow-md border border-border animate-fade-in-up"
```

---

## BLOCO 7 — Tipagem audit_recipients (O1)

**Arquivo:** `src/hooks/useAuditRules.ts:16`

Substituir:
```typescript
alert_recipients: unknown;
```
Por:
```typescript
alert_recipients: string[];
```

---

## BLOCO 8 — key={i} em lista dinâmica (A2)

**Arquivo:** `src/pages/Audits.tsx:626`

Substituir `key={i}` por key baseada no conteúdo:
```typescript
{formRecipients.map((r, i) => (
  <div key={`recipient-${r || i}`} ...>
```

---

## VERIFICAÇÃO PÓS-DEPLOY

**Funcional (1 minuto):**
1. Abrir Dashboard (/) → gráfico de score buckets renderiza com cores corretas?
2. Abrir ClientDetailPage → chart de tom trend + barra de distribuição com cores certas?
3. Abrir /demands/dashboard → gráfico de prioridade com cores certas?
4. Abrir SearchPage → badges de tom com cores certas?
5. Abrir GistContactWizard → botão "Salvar" mostra spinner via mutation?
6. Abrir /agendas → cards aparecem com animação fade-in-up?
7. Abrir qualquer lista com loading → skeleton usa shimmer (não pulse)?

**TypeScript (build):**
```bash
npm run build
# Deve compilar sem erros
# Os 10 casts simplificados não devem quebrar — se algum quebrar, reportar qual
```

Reportar ao Operador: os 7 itens funcionais + build passaram?
