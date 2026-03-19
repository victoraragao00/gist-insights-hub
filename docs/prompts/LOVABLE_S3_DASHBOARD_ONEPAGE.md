# Prompt Lovable — Sprint S3: Dashboard Analítico + One-Page do Cliente

> **Issue:** https://github.com/HyTrackWater/gist-insights-hub/issues/69
> **Fase:** 7.3 — Módulo de Tickets, Sprint S3
> **Pré-requisito:** Sprints S1-A, S1-B, S1-C, S2 concluídas
> **Repo:** https://github.com/HyTrackWater/gist-insights-hub
> **Supabase project:** qyfwbmukylyfsgzgocfo

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

Leia CONTEXT.md, AGENTS.md e docs/DESIGN_SYSTEM.md antes de iniciar.

---

## OBRIGATÓRIO

1. Migrations via migration tool — nunca DDL manual
2. RLS usando `user_accessible_client_ids(auth.uid())` — nunca sub-select direto em `user_client_access`
3. `created_by UUID` sem `REFERENCES auth.users(id)` — UUID plain
4. Seguir Checklist CTO m1–m13 em todo código gerado
5. `useMutation` para toda operação de escrita (m9)
6. `sonner` para toasts — nunca `use-toast` (m3)
7. Erros Supabase sempre tratados — `{ data, error }` destructurado (m8)
8. Seguir docs/DESIGN_SYSTEM.md em todas as decisões visuais
9. Paginação real em listas > 50 itens (m12)
10. Manter TODO o código existente que não é mencionado neste prompt

## PROIBIDO

1. Tocar em `src/integrations/supabase/*`, `supabase/config.toml`, `.env`
2. `REFERENCES auth.users(id)` em qualquer FK nova
3. Sub-select direto em `user_client_access` em RLS policies — usar `user_accessible_client_ids(auth.uid())`
4. Drawer — usar Sheet (Design System seção 3.1)
5. Arbitrary values Tailwind (`w-[347px]`)
6. Permitir comentários ou input do cliente na One-Page — somente visualização
7. Reverter código de componentes existentes

---

## NOTAS TÉCNICAS IMPORTANTES

**Campos que JÁ EXISTEM na tabela `demands` (migration S1-A):**
- `cancellation_reason TEXT` — já existe, NÃO criar novamente
- `blocked_at TIMESTAMPTZ` — já existe, NÃO criar novamente
- `blocked_by TEXT` — já existe, NÃO criar novamente
- `blocker_reason TEXT` — já existe, NÃO criar novamente
- `is_blocked BOOLEAN` — já existe, NÃO criar novamente

**NÃO criar migration para ALTER TABLE demands** — todos os campos necessários já estão lá.

**Rota pública:** A rota `/public/demands/:token` DEVE ficar FORA do `ProtectedRoute` no `App.tsx`. Se ficar dentro, vai redirecionar para login. Colocar a `<Route>` no mesmo nível das rotas `/login` e `/signup`.

---

## PARTE 1 — MIGRATIONS

### Migration 1: demand_client_tokens

```sql
CREATE TABLE demand_client_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE demand_client_tokens ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer user com acesso ao client
CREATE POLICY demand_client_tokens_select ON demand_client_tokens
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

-- Escrita: apenas admins (usando user_accessible_client_ids, NÃO sub-select em user_client_access)
CREATE POLICY demand_client_tokens_insert ON demand_client_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY demand_client_tokens_update ON demand_client_tokens
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY demand_client_tokens_delete ON demand_client_tokens
  FOR DELETE TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );
```

**Nota:** A restrição admin-only será tratada no frontend (hook verifica `isAdmin`). A RLS garante que o user tem acesso ao client, o frontend restringe a ação a admins.

### Migration 2: demand_watchers

```sql
CREATE TABLE demand_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(demand_id, user_id)
);

ALTER TABLE demand_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_watchers_select ON demand_watchers
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_watchers_insert ON demand_watchers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY demand_watchers_delete ON demand_watchers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

---

## PARTE 2 — DB FUNCTIONS

### `get_demand_analytics(p_client_id UUID, p_days INT DEFAULT 30)`

```sql
CREATE OR REPLACE FUNCTION get_demand_analytics(
  p_client_id UUID DEFAULT NULL,
  p_days INT DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH base AS (
    SELECT d.*,
      tc.triggers_finished_at,
      tc.name AS column_name,
      EXTRACT(EPOCH FROM (d.finished_at - d.created_at))/3600 AS lead_time_hours,
      EXTRACT(EPOCH FROM (d.finished_at - d.started_at))/3600 AS cycle_time_hours
    FROM demands d
    JOIN ticket_columns tc ON tc.id = d.column_id
    WHERE (p_client_id IS NULL OR d.client_id = p_client_id)
      AND d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
      AND d.created_at >= now() - (p_days || ' days')::interval
  ),
  by_type AS (
    SELECT dt.name, dt.color, COUNT(*) AS total
    FROM base b
    JOIN demand_types dt ON dt.id = b.demand_type_id
    GROUP BY dt.name, dt.color
  ),
  by_priority AS (
    SELECT priority::text, COUNT(*) AS total
    FROM base GROUP BY priority
  ),
  by_column AS (
    SELECT column_name AS name, COUNT(*) AS total
    FROM base GROUP BY column_name
  ),
  by_area AS (
    SELECT COALESCE(da.name, 'Sem área') AS name, da.color, COUNT(*) AS total
    FROM base b
    LEFT JOIN demand_areas da ON da.id = b.area_id
    GROUP BY da.name, da.color
  ),
  weekly AS (
    SELECT DATE_TRUNC('week', created_at)::date AS week, COUNT(*) AS total
    FROM base GROUP BY 1 ORDER BY 1
  )
  SELECT json_build_object(
    'totals', json_build_object(
      'total', (SELECT COUNT(*) FROM base),
      'open', (SELECT COUNT(*) FROM base WHERE finished_at IS NULL AND NOT is_blocked),
      'completed', (SELECT COUNT(*) FROM base WHERE triggers_finished_at = true AND finished_at IS NOT NULL),
      'blocked', (SELECT COUNT(*) FROM base WHERE is_blocked = true),
      'avg_lead_time_hours', (SELECT ROUND(AVG(lead_time_hours)::NUMERIC, 1) FROM base WHERE lead_time_hours > 0),
      'avg_cycle_time_hours', (SELECT ROUND(AVG(cycle_time_hours)::NUMERIC, 1) FROM base WHERE cycle_time_hours > 0)
    ),
    'by_type', (SELECT COALESCE(json_agg(row_to_json(by_type)), '[]'::json) FROM by_type),
    'by_priority', (SELECT COALESCE(json_agg(row_to_json(by_priority)), '[]'::json) FROM by_priority),
    'by_column', (SELECT COALESCE(json_agg(row_to_json(by_column)), '[]'::json) FROM by_column),
    'by_area', (SELECT COALESCE(json_agg(row_to_json(by_area)), '[]'::json) FROM by_area),
    'weekly_trend', (SELECT COALESCE(json_agg(row_to_json(weekly)), '[]'::json) FROM weekly)
  ) INTO result;

  RETURN result;
END;
$$;
```

### `get_client_public_demands(p_token TEXT)`

```sql
CREATE OR REPLACE FUNCTION get_client_public_demands(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  result JSON;
BEGIN
  SELECT client_id INTO v_client_id
  FROM demand_client_tokens
  WHERE token = p_token AND active = true;

  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Token inválido');
  END IF;

  SELECT json_build_object(
    'client', (SELECT json_build_object('name', c.name) FROM clients c WHERE c.id = v_client_id),
    'totals', json_build_object(
      'total', COUNT(*),
      'open', COUNT(*) FILTER (WHERE d.finished_at IS NULL),
      'completed', COUNT(*) FILTER (WHERE d.finished_at IS NOT NULL),
      'blocked', COUNT(*) FILTER (WHERE d.is_blocked = true)
    ),
    'demands', COALESCE(json_agg(
      json_build_object(
        'id', d.id,
        'title', d.title,
        'priority', d.priority,
        'type', dt.name,
        'column', tc.name,
        'area', da.name,
        'assignee', ass.name,
        'is_blocked', d.is_blocked,
        'created_at', d.created_at,
        'started_at', d.started_at,
        'finished_at', d.finished_at
      ) ORDER BY d.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM demands d
  JOIN demand_types dt ON dt.id = d.demand_type_id
  JOIN ticket_columns tc ON tc.id = d.column_id
  LEFT JOIN demand_areas da ON da.id = d.area_id
  LEFT JOIN demand_assignees ass ON ass.id = d.assignee_id
  WHERE d.client_id = v_client_id;

  RETURN result;
END;
$$;
```

**IMPORTANTE:** NÃO expor na One-Page: `notes`, `description`, `expected_result`, `rfi_url`, `created_by`, `blocker_reason`.

---

## PARTE 3 — EDGE FUNCTION: client-demands-public

**Arquivo:** `supabase/functions/client-demands-public/index.ts`

- `GET /client-demands-public?token=<token>`
- Sem autenticação — usar `service_role` para chamar a DB function
- Chama `get_client_public_demands(token)`
- Se token inválido → retorna `{ error: "Token inválido" }` com status 404
- CORS habilitado

---

## PARTE 4 — HOOKS

### `src/hooks/useDemandAnalytics.ts`
```typescript
// useDemandAnalytics(clientId?, days?)
queryKey: ['demand_analytics', clientId ?? 'all', days]
staleTime: 120_000
// RPC: get_demand_analytics(p_client_id, p_days)
```

### `src/hooks/useDemandWatchers.ts`
```typescript
// useDemandWatchers(demandId)
queryKey: ['demand_watchers', demandId]
staleTime: 60_000
enabled: !!demandId

// useToggleWatcher() — useMutation
// Se já é watcher: DELETE FROM demand_watchers WHERE demand_id AND user_id
// Se não é watcher: INSERT INTO demand_watchers (demand_id, user_id)
// invalidateQueries(['demand_watchers', demandId])
```

### `src/hooks/useClientToken.ts`
```typescript
// useClientToken(clientId) — admin only
queryKey: ['client_token', clientId]
staleTime: 300_000
enabled: !!clientId

// useGenerateClientToken() — useMutation
// UPSERT demand_client_tokens (ON CONFLICT (client_id) UPDATE SET token = encode(gen_random_bytes(32), 'hex'))
// invalidateQueries(['client_token', clientId])
```

### `src/hooks/usePublicDemands.ts`
```typescript
// usePublicDemands(token)
queryKey: ['public_demands', token]
staleTime: 60_000
enabled: !!token
// Chama Edge Function: supabase.functions.invoke('client-demands-public', { body: { token } })
// OU fetch direto com GET ?token=
```

### `src/hooks/useExportDemandsCSV.ts`
```typescript
// useExportDemandsCSV() — useMutation
// Busca demands com joins (tipo, coluna, area, assignee, client)
// Gera CSV string com colunas: ID, Título, Tipo, Prioridade, Coluna, Área, Responsável, Cliente, Criação, Início, Conclusão
// Download via link[download] ou Blob + URL.createObjectURL
```

---

## PARTE 5 — FRONTEND

### 5.1 Dashboard Analítico (`/demands/dashboard`)

Nova página: `src/pages/DemandsDashboardPage.tsx`

Registrar rota em App.tsx dentro do ProtectedRoute, com ErrorBoundary.
Adicionar item "Dashboard" no submenu ou sidebar de Demandas.

**Filtros:**
- Dropdown "Cliente" (todos ou específico) via `useClient()`
- Dropdown "Período" (7d / 30d / 90d)

**KPI Cards (6):** Total, Abertos, Concluídos, Bloqueados, Lead Time médio, Cycle Time médio

**Gráficos via Recharts:**
- BarChart: tickets por tipo (cor do demand_type)
- PieChart: distribuição por prioridade (cores do Design System)
- BarChart horizontal: tickets por coluna
- BarChart: tickets por área
- LineChart: tendência semanal

**Design:** seguir o padrão visual do Dashboard existente (`Index.tsx`) — mesmos componentes, mesmas animações fade-in-up.

### 5.2 Sistema de Bloqueio no DemandDetailSheet

Adicionar seção "Bloqueio" no DemandDetailSheet:

**Quando `is_blocked = false`:**
- Botão "Marcar como bloqueado" → Dialog:
  - Motivo (textarea obrigatório → `blocker_reason`)
  - Bloqueado por (texto → `blocked_by`)
  - Confirmar → UPDATE `is_blocked=true, blocked_at=now(), blocker_reason, blocked_by` + INSERT activity `event_type='blocked'`

**Quando `is_blocked = true`:**
- Badge vermelho "Bloqueado" com data e motivo visíveis
- Botão "Desbloquear" → AlertDialog → UPDATE `is_blocked=false, blocked_at=null, blocker_reason=null, blocked_by=null` + INSERT activity `event_type='unblocked'`

### 5.3 Sistema de Cancelamento no DemandDetailSheet

Botão "Cancelar demanda" (ao lado do botão Excluir, no rodapé):
- Dialog com Select de motivo:
  - Cliente mudou de escopo
  - Duplicata de outra demanda
  - Sem resposta do cliente
  - Revisão estratégica
  - Outro (habilita textarea)
- Confirmar → mover para coluna "Cancelado" (buscar pelo nome) + salvar `cancellation_reason` + INSERT activity `event_type='cancelled'`

### 5.4 Watchers no DemandDetailSheet

Seção "Observadores" no Sheet:
- Lista de watchers (user_id) — exibir avatar (inicial)
- Botão toggle "Observar" / "Parar de observar" para o user atual
- `useToggleWatcher()`

### 5.5 One-Page do Cliente (`/public/demands/:token`)

Nova página: `src/pages/PublicDemandsPage.tsx`

**IMPORTANTE:** Rota FORA do ProtectedRoute no App.tsx:
```tsx
<Route path="/public/demands/:token" element={<PublicDemandsPage />} />
```

**Layout:**
- Sem sidebar, sem header do CX Hub — layout próprio mínimo
- Header: logo uMode + nome do cliente
- 4 KPI cards: Total, Abertos, Concluídos, Bloqueados
- Tabela de tickets: Título, Tipo, Prioridade, Status (coluna atual), Área, Responsável, Abertura
- Filtros simples: dropdown Status, dropdown Tipo
- Rodapé: "Central de Demandas — uMode Tecnologia"
- Se token inválido: "Link inválido ou expirado" com visual clean

**Dados:** via Edge Function `client-demands-public` ou via `usePublicDemands(token)`

### 5.6 Token na ClientDetailPage

Adicionar na aba "Configurações" (visível apenas para admin):

**Seção "One-Page do Cliente":**
- Se token existe: URL completa com botão copiar (clipboard)
- Botão "Regenerar link" → AlertDialog aviso → `useGenerateClientToken()`
- Se não existe: botão "Gerar link"

### 5.7 Export CSV na DemandsPage

Botão "Exportar CSV" no header da DemandsPage:
- Respeita filtros ativos
- Colunas: ID, Título, Tipo, Prioridade, Coluna, Área, Responsável, Cliente, Criação, Início, Conclusão
- Download como `demandas_YYYY-MM-DD.csv`

---

## ESCOPO DE ARQUIVOS

| Arquivo | Ação |
|---|---|
| Nova migration | demand_client_tokens + demand_watchers + RLS |
| Nova migration | DB functions get_demand_analytics + get_client_public_demands |
| `supabase/functions/client-demands-public/index.ts` | Novo — Edge Function pública |
| `src/hooks/useDemandAnalytics.ts` | Novo |
| `src/hooks/useDemandWatchers.ts` | Novo |
| `src/hooks/useClientToken.ts` | Novo |
| `src/hooks/usePublicDemands.ts` | Novo |
| `src/hooks/useExportDemandsCSV.ts` | Novo |
| `src/pages/DemandsDashboardPage.tsx` | Novo — dashboard analítico |
| `src/pages/PublicDemandsPage.tsx` | Novo — One-Page pública |
| `src/components/demands/DemandDetailSheet.tsx` | Modificar — bloqueio, cancelamento, watchers |
| `src/pages/ClientDetailPage.tsx` | Modificar — seção token na aba Configurações |
| `src/pages/DemandsPage.tsx` | Modificar — botão Export CSV |
| `src/App.tsx` | Modificar — rotas `/demands/dashboard` e `/public/demands/:token` |

---

## VERIFICAÇÃO PÓS-DEPLOY

**SQL (Operador executa):**
```sql
-- 1. Tabelas novas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('demand_client_tokens', 'demand_watchers');

-- 2. RLS ativo
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('demand_client_tokens', 'demand_watchers');

-- 3. DB functions
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('get_demand_analytics', 'get_client_public_demands');

-- 4. Edge Function (testar com token inválido)
-- GET /client-demands-public?token=invalido → { "error": "Token inválido" }
```

**Funcional (11 itens):**
1. Dashboard `/demands/dashboard` carrega com KPIs e gráficos?
2. Filtro por cliente e período funciona?
3. Gráficos renderizam com dados reais (recharts)?
4. Marcar ticket como bloqueado → badge no card e no Sheet + activity log?
5. Desbloquear → campos limpos e activity registrada?
6. Cancelar demanda → move para coluna "Cancelado" com motivo + activity?
7. Toggle watcher funciona para o usuário atual?
8. Gerar token na ClientDetailPage → URL gerada e copiável?
9. Acessar `/public/demands/:token` sem login → lista de tickets?
10. Token inválido → página "Link inválido ou expirado"?
11. Export CSV → arquivo baixado com colunas corretas?

Reportar ao Operador: os 11 itens passaram?
