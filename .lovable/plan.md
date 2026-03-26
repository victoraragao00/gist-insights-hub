

## Dívida Técnica Completa (DT-1) — 8 Blocos

Prompt verificado contra o código atual. Todas as 13 pendências confirmadas. Nenhuma divergência encontrada.

### Resumo dos 8 blocos

1. **Paleta centralizada** — Criar `src/lib/colorPalette.ts` com TONE_CONFIG, TONE_CHART_COLORS, TONE_BAR_COLORS, PRIORITY_CHART_COLORS, SCORE_BUCKET_COLORS, SATISFACTION_CONFIG. Remover duplicatas em ClientDetailPage (L123-128), ClientsPage (L71-76), SearchPage (L35-40). Substituir HSL hardcoded em Index.tsx (L129-134), DemandsDashboardPage (L26-31). Substituir SATISFACTION_OPTIONS em SatisfactionPicker.

2. **10x `as unknown as`** — Simplificar casts em useDemands, useClientDemands, useDemandAnalytics, useDemandInteractions, useMeetingAgendas (2x), useMeetingHomework, ColumnSettingsTab (2x — manter `as unknown as` se TS reclamar pois `err` vem de catch), ClientDetailPage (L329).

3. **GistContactWizard → useMutation** — Remover `useState(false)` para saving (L97). Criar `saveMutation` com `useMutation`. Substituir `handleSave` manual por `saveMutation.mutate()`. Usar `saveMutation.isPending` no botão.

4. **Imports não usados** — Remover `useQuery` de AgendasPage.tsx (L2) e CreateAgendaDialog.tsx (L2).

5. **Skeleton shimmer** — Em `skeleton.tsx`, trocar `animate-pulse` por `animate-shimmer` (já registrado em tailwind.config.ts).

6. **Stagger animation** — Em AgendasPage.tsx (L73), adicionar classe `animate-fade-in-up` ao Card que tem `style={{ animationDelay, opacity: 0 }}` mas sem classe de animação.

7. **Tipagem alert_recipients** — Em useAuditRules.ts (L16), trocar `unknown` por `string[]`.

8. **key={i}** — Em Audits.tsx (L627), trocar `key={i}` por `key={\`recipient-${r || i}\`}`.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/lib/colorPalette.ts` | Novo |
| `src/pages/ClientDetailPage.tsx` | Import paleta + remover TONE_CONFIG local + usar TONE_CHART_COLORS/TONE_BAR_COLORS + simplificar cast L329 |
| `src/pages/ClientsPage.tsx` | Import paleta + remover TONE_CONFIG local |
| `src/pages/SearchPage.tsx` | Import paleta + remover TONE_CONFIG local |
| `src/pages/DemandsDashboardPage.tsx` | Import PRIORITY_CHART_COLORS + remover PRIORITY_COLORS local |
| `src/pages/Index.tsx` | Import SCORE_BUCKET_COLORS + substituir array hardcoded |
| `src/components/agendas/SatisfactionPicker.tsx` | Import SATISFACTION_CONFIG + remover array local (nota: SatisfactionPicker usa lucide icons, não emojis — adaptar SATISFACTION_CONFIG para manter icons) |
| `src/components/GistContactWizard.tsx` | useState → useMutation |
| `src/pages/AgendasPage.tsx` | Remover import useQuery + adicionar animate-fade-in-up |
| `src/components/agendas/CreateAgendaDialog.tsx` | Remover import useQuery |
| `src/components/ui/skeleton.tsx` | animate-pulse → animate-shimmer |
| `src/hooks/useAuditRules.ts` | alert_recipients: string[] |
| `src/pages/Audits.tsx` | key baseada em conteúdo |
| `src/hooks/useDemands.ts` | Simplificar cast |
| `src/hooks/useClientDemands.ts` | Simplificar cast |
| `src/hooks/useDemandAnalytics.ts` | Simplificar cast |
| `src/hooks/useDemandInteractions.ts` | Simplificar cast |
| `src/hooks/useMeetingAgendas.ts` | Simplificar 2 casts |
| `src/hooks/useMeetingHomework.ts` | Simplificar cast |
| `src/components/demands/ColumnSettingsTab.tsx` | Simplificar 2 casts (manter `as unknown as` se TS falhar) |

### Nota importante: SatisfactionPicker

O prompt sugere usar emojis (😡😟😐🙂😍) do `SATISFACTION_CONFIG`, mas o componente atual usa **lucide icons** (Skull, Frown, Meh, Smile). Para manter compatibilidade, o `SATISFACTION_CONFIG` no colorPalette.ts terá apenas `color` e `label` — os icons continuam no componente. Não vou trocar icons por emojis.

### Sem alterações em
- Edge Functions
- Migrations/RLS
- Lógica de queries ou mutations
- `src/integrations/supabase/*`

