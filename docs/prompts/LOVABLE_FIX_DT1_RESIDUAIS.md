# LOVABLE — Dívida Técnica Residuais (DT-1b)
# CX Hub uMode — 2026-03-30
# Repo: https://github.com/HyTrackWater/gist-insights-hub

---

Leia CONTEXT.md e AGENTS.md antes de iniciar. Correções cirúrgicas — 6 itens pontuais.

---

## OBRIGATÓRIO

1. Não alterar lógica de negócio — apenas corrigir tipagem, imports de cores e error handling
2. Erros Supabase sempre tratados — `{ data, error }` destructurado (m8)
3. `sonner` para toasts (m3)

## PROIBIDO

1. Tocar em `src/integrations/supabase/*`, `supabase/config.toml`, `.env`
2. Alterar Edge Functions
3. Adicionar features novas
4. Alterar outros arquivos fora desta lista

---

## FIX 1 — Index.tsx: HSL hardcoded no ChartContainer (DS-R1)

**Arquivo:** `src/pages/Index.tsx` (~linha 273)

Importar `TONE_CHART_COLORS` e substituir HSL hardcoded:

```typescript
import { TONE_CHART_COLORS } from "@/lib/colorPalette";
```

Substituir:
```typescript
config={{ ok: { label: "Ok", color: "hsl(160, 84%, 39%)" }, atencao: { label: "Atenção", color: "hsl(48, 96%, 53%)" }, alerta: { label: "Alerta", color: "hsl(25, 95%, 53%)" }, critico: { label: "Crítico", color: "hsl(0, 84%, 60%)" } }}
```

Por:
```typescript
config={{
  ok: { label: "Ok", color: TONE_CHART_COLORS.ok },
  atencao: { label: "Atenção", color: TONE_CHART_COLORS.atencao },
  alerta: { label: "Alerta", color: TONE_CHART_COLORS.alerta },
  critico: { label: "Crítico", color: TONE_CHART_COLORS.critico },
}}
```

---

## FIX 2 — ClientDetailPage.tsx: bg-green-500 → TONE_BAR_COLORS (DS-R2)

**Arquivo:** `src/pages/ClientDetailPage.tsx` (~linha 713)

Importar `TONE_BAR_COLORS` (se ainda não importado) e substituir:

```typescript
const colors: Record<string, string> = {
  ok: "bg-green-500", atencao: "bg-yellow-500", alerta: "bg-orange-500", critico: "bg-red-500",
};
```

Por:
```typescript
const colors = TONE_BAR_COLORS;
```

Garantir que `TONE_BAR_COLORS` está importado de `@/lib/colorPalette`.

---

## FIX 3 — ClientDetailPage.tsx: cast simples (M1-R2)

**Arquivo:** `src/pages/ClientDetailPage.tsx` (~linha 344)

Substituir:
```typescript
(clientDemands as unknown as DemandRow[])
```

Por:
```typescript
(clientDemands as DemandRow[])
```

---

## FIX 4 — useDemandAnalytics.ts: cast simples (M1-R3)

**Arquivo:** `src/hooks/useDemandAnalytics.ts` (~linha 53)

Substituir:
```typescript
data as unknown as DemandAnalyticsData
```

Por:
```typescript
data as DemandAnalyticsData
```

---

## FIX 5 — AppSidebar.tsx: onError no logoutMutation (F16)

**Arquivo:** `src/components/AppSidebar.tsx` (~linha 50-56)

Adicionar `onError` ao `logoutMutation`:

```typescript
const logoutMutation = useMutation({
  mutationFn: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  onSuccess: () => navigate("/login"),
  onError: () => {
    toast.error("Erro ao sair. Tente novamente.");
  },
});
```

Garantir que `toast` está importado de `sonner`.

---

## FIX 6 — DemandsDashboardPage.tsx: error handling na query blocked_demands (F17)

**Arquivo:** `src/pages/DemandsDashboardPage.tsx` (~linha 50-76)

A query `blocked_demands` não mostra feedback ao usuário em caso de erro. Duas opções:

**Opção A (preferida):** Usar `meta.onError` ou `useEffect` com o error state:
```typescript
const { data: blockedDemands = [], isLoading: loadingBlocked, error: blockedError } = useQuery<...>({
  // ... query existente
});

// Adicionar após a query:
useEffect(() => {
  if (blockedError) {
    toast.error("Erro ao carregar tickets bloqueados");
  }
}, [blockedError]);
```

**Opção B:** Wrap no queryFn com toast inline:
```typescript
queryFn: async () => {
  const { data, error } = await supabase.from(...);
  if (error) {
    toast.error("Erro ao carregar tickets bloqueados");
    throw error;
  }
  return data;
},
```

---

## VERIFICAÇÃO PÓS-DEPLOY

```bash
npm run build
# Deve compilar sem erros
```

**Visual (30 segundos):**
1. Dashboard (/) → gráfico de tom usa cores corretas (sem HSL inline)?
2. ClientDetailPage → barra de distribuição usa emerald (não green)?
3. Logout → forçar erro de rede → toast aparece?

Reportar ao Operador: build + 3 visuais passaram?
