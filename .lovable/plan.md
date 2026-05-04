# S0-B — Horas Trabalhadas em Demandas (revisado)

Adicionar rastreamento de tempo por demanda: timer persistente em banco (start/stop), entradas manuais (horas + descrição), total agregado, badge no Kanban — com **garantia de timer único global por usuário**.

## 1. Migration — `demand_time_entries`

Tabela conforme SQL do prompt, com 2 ajustes para alinhar aos padrões do projeto:
- `user_accessible_client_ids` recebe `_user_id uuid` → passar `auth.uid()`.
- Função retorna `SETOF uuid` → usar `IN (SELECT ...)` (não `= ANY`).

```sql
CREATE TABLE demand_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  hours_manual NUMERIC(6,2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hours CHECK (
    (started_at IS NOT NULL AND ended_at IS NOT NULL AND hours_manual IS NULL)
    OR (started_at IS NULL AND ended_at IS NULL AND hours_manual IS NOT NULL AND hours_manual > 0)
    OR (started_at IS NOT NULL AND ended_at IS NULL AND hours_manual IS NULL)
  )
);

CREATE INDEX idx_time_entries_demand ON demand_time_entries(demand_id);
CREATE INDEX idx_time_entries_user ON demand_time_entries(user_id);
CREATE INDEX idx_time_entries_active ON demand_time_entries(user_id)
  WHERE ended_at IS NULL AND started_at IS NOT NULL;

-- Garantia hard: no máximo 1 timer ativo por usuário (defesa em profundidade)
CREATE UNIQUE INDEX uq_time_entries_one_active_per_user
  ON demand_time_entries(user_id)
  WHERE ended_at IS NULL AND started_at IS NOT NULL;

ALTER TABLE demand_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON demand_time_entries FOR SELECT USING (
  demand_id IN (
    SELECT d.id FROM demands d
    WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  )
);
CREATE POLICY "time_entries_insert" ON demand_time_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_entries_update" ON demand_time_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "time_entries_delete" ON demand_time_entries FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION get_demand_total_hours(p_demand_id UUID)
RETURNS NUMERIC LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN hours_manual IS NOT NULL THEN hours_manual
      WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0
      ELSE 0
    END
  ), 0)::NUMERIC
  FROM demand_time_entries WHERE demand_id = p_demand_id;
$$;
```

**Por que o índice único parcial:** mesmo que o frontend tenha bug ou race condition (dois cliques simultâneos, duas abas), o banco rejeita o segundo INSERT com erro `23505`. Defesa em camadas.

## 2. Hook — `src/hooks/useDemandTimeEntries.ts`

Padrão idêntico a `useDemandWatchers`: queryKey com `user?.id` + `demandId`, `staleTime: 30000`, `{ data, error }` em todas chamadas, `useMutation` para escrita, toasts via `sonner`.

```ts
useDemandTimeEntries(demandId)        // SELECT *, user_profiles(full_name,email) ORDER BY created_at DESC
useActiveTimerEntry(demandId)         // timer ativo NESTA demanda (para UI do botão Iniciar/Finalizar)
useUserActiveTimer()                  // timer ativo do usuário em QUALQUER demanda (global)
useDemandTotalHours(demandId)         // RPC get_demand_total_hours
useStartTimer()                       // INSERT — com guarda global (ver abaixo)
usePauseTimer()                       // UPDATE { ended_at: now() } WHERE id = entryId
useAddManualEntry()                   // INSERT { demand_id, user_id, hours_manual, description }
useDeleteTimeEntry()                  // DELETE WHERE id = entryId
```

**`useStartTimer` — guarda global (correção do gap):**

```ts
mutationFn: async ({ demandId }) => {
  if (!user?.id) throw new Error("Não autenticado");

  // 1) Guarda em SW: bloqueia se já existe timer ativo em qualquer demanda
  const { data: existing, error: checkErr } = await supabase
    .from("demand_time_entries")
    .select("id, demand_id, demands(title)")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .not("started_at", "is", null)
    .maybeSingle();
  if (checkErr) throw checkErr;
  if (existing) {
    throw new Error(
      `Você já tem um timer ativo em "${existing.demands?.title ?? "outra demanda"}". Finalize antes de iniciar um novo.`
    );
  }

  // 2) INSERT (índice único garante atomicidade contra race)
  const { data, error } = await supabase
    .from("demand_time_entries")
    .insert({ demand_id: demandId, user_id: user.id, started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("Você já tem um timer ativo em outra demanda.");
    }
    throw error;
  }
  return data;
},
onSuccess: () => {
  toast.success("Timer iniciado");
  queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
  queryClient.invalidateQueries({ queryKey: ["user-active-timer"] });
  queryClient.invalidateQueries({ queryKey: ["demand-total-hours"] });
},
onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao iniciar timer"),
```

`useUserActiveTimer()` retorna `{ id, demand_id, demand_title, started_at } | null` — usado na UI para mostrar aviso e link "Ir para demanda X".

## 3. UI — Seção "Tempo trabalhado" na `DemandDetailPage`

Novo componente `src/components/demands/DemandTimeTrackingSection.tsx` montado em `DemandDetailContent`.

Layout:
```text
Tempo trabalhado
┌──────────────────────────────────────────────┐
│ Σ 3h 20min                  [▶ Iniciar timer]│
│  ⚠ Timer ativo em "Outra demanda" → Ir       │  (só se useUserActiveTimer != null E != esta)
├──────────────────────────────────────────────┤
│ Manual: [horas] [descrição]      [Adicionar] │
├──────────────────────────────────────────────┤
│ ▼ 4 entradas                                 │
│  • Você · há 2h · 1h 30min            [🗑]   │
│  • Maria · ontem · 2h (manual)        [🗑]   │
└──────────────────────────────────────────────┘
```

- Botão "▶ Iniciar timer" fica **disabled** quando `useUserActiveTimer()` retorna timer em outra demanda; tooltip explica.
- Quando o timer ativo é nesta demanda → botão vira "⏹ Finalizar" + cronômetro `HH:MM:SS` (`setInterval` lê `started_at`).
- Refresh da página → timer continua de onde parou (lê do banco).
- Lista colapsável com `AlertDialog` na exclusão; ícone só aparece para entradas do próprio usuário.

## 4. Badge no Kanban — `DemandCard.tsx`

`DemandRow` ganha `total_hours?: number | null`. Quando `> 0`:

```tsx
<Badge variant="outline" className="text-xs gap-1">
  <Clock className="h-3 w-3" /> {formatHours(total_hours)}
</Badge>
```

Helper `src/lib/formatHours.ts` → `"3h 20min"`, compartilhado.

## 5. Popular `total_hours` em `useDemands` sem N+1

Após o SELECT principal de demandas:
- `supabase.from('demand_time_entries').select('demand_id, started_at, ended_at, hours_manual').in('demand_id', ids)`
- Reduzir client-side em `Map<demandId, totalHours>` e fundir.
- Mesmo pattern em `useDemand(id)` — uma chamada extra.

Sem migration adicional, RLS continua valendo via `demands.client_id`.

## Detalhes técnicos

- **Arquivos novos:**
  - `supabase/migrations/<timestamp>_demand_time_entries.sql`
  - `src/hooks/useDemandTimeEntries.ts`
  - `src/components/demands/DemandTimeTrackingSection.tsx`
  - `src/lib/formatHours.ts`
- **Arquivos editados:**
  - `src/hooks/useDemands.ts` — campo `total_hours` + agregação pós-fetch
  - `src/components/demands/DemandCard.tsx` — badge ⏱
  - `src/components/demands/DemandDetailSheet.tsx` — montar `<DemandTimeTrackingSection demandId={demand.id} />`
- **Padrões aplicados:** m4 (`staleTime: 30_000`), m5 (queryKey com `user?.id`), m8 (`{ data, error }`), m9 (`useMutation`), m11, `sonner`, sem `localStorage`. Tipos via `Tables<"demand_time_entries">`.

## Verificação pós-deploy

1. `SELECT rowsecurity FROM pg_tables WHERE tablename = 'demand_time_entries';` → `true`.
2. `SELECT get_demand_total_hours('<uuid>');` → numérico.
3. Iniciar timer em demanda A → abrir demanda B → botão "▶ Iniciar" disabled + aviso "Timer ativo em A".
4. Tentar driblar via 2 abas simultâneas → segundo INSERT falha com `23505` (índice único).
5. Refresh → timer da demanda A continua de onde parou.
6. Finalizar → entrada listada com duração correta + badge ⏱ aparece no Kanban.
