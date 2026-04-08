

## Plan: Fix ocorrências table, acentuação nos filtros, tooltips com rubrica fixa

### Problema 1 — Tabela de ocorrências vazia na página 1

A causa real não é offset errado — a paginação usa `pageInteractions` iniciando em 0, o que é correto. O problema é que `nonOkInteractions` filtra a partir de `interactions`, que traz apenas 50 registros por página (ordenados por data DESC). Se as 50 interações mais recentes são "ok", a tabela aparece vazia.

**Fix:** Adicionar uma query separada dedicada a buscar apenas interações não-ok dos últimos 30 dias, com limit de 20, independente da paginação principal. Isso não altera a query existente — adiciona uma nova.

```typescript
const { data: nonOkData = [] } = useQuery<Interaction[]>({
  queryKey: ["detail_non_ok_interactions", user?.id, clientId, thirtyDaysAgo],
  enabled: !!clientId && !!user?.id,
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("interactions")
      .select("id, tone, occurred_at, sender_raw, sender_side, content, channel, is_out_of_scope, theme, conversation_id")
      .eq("client_id", clientId!)
      .gte("occurred_at", thirtyDaysAgo)
      .in("tone", ["atencao", "alerta", "critico"])
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as Interaction[];
  },
});
```

Atualizar `nonOkInteractions` useMemo para usar `nonOkData` em vez de `interactions`:

```typescript
const nonOkInteractions = useMemo(() => {
  let filtered = nonOkData;
  if (selectedTone !== "todos") filtered = filtered.filter((i) => i.tone === selectedTone);
  if (selectedDate) filtered = filtered.filter((i) => i.occurred_at.startsWith(selectedDate));
  return filtered.slice(0, 20);
}, [nonOkData, selectedTone, selectedDate]);
```

### Problema 2 — Acentuação nos filtros (linha 775)

Substituir a lógica de capitalização por um mapa de labels:

```typescript
const TONE_FILTER_LABELS: Record<string, string> = {
  todos: "Todos", atencao: "Atenção", alerta: "Alerta", critico: "Crítico"
};
// No botão:
{TONE_FILTER_LABELS[t] ?? t}
```

### Problema 3 — Tooltips com rubrica fixa

Substituir `getToneTooltip()` (linhas 120-132) por rubrica fixa:

```typescript
const TONE_RUBRIC: Record<string, string> = {
  ok: "✅ Ok — Interação neutra ou positiva, sem fricção identificada.",
  atencao: "⚠️ Atenção — Ponto de fricção que pode escalar se não tratado. Monitore e considere uma ação preventiva.",
  alerta: "🔶 Alerta — Frustração clara ou problema que precisa de atenção rápida. Responda em breve.",
  critico: "🔴 Crítico — Insatisfação severa, urgência ou risco real de perda do cliente. Ação imediata necessária.",
};
```

Aplicar tooltip em todos os badges de tom:
- Coluna Tom da tabela de ocorrências (já existe, trocar conteúdo para `TONE_RUBRIC`)
- Badge "Tom Predominante" no header (KPICard na linha 660 — envolver com tooltip)
- Qualquer outro badge de tom visível na Visão Geral (distribuição de tom, linha ~695)

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/ClientDetailPage.tsx` |

### No changes to
- Outras abas, hooks externos, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

