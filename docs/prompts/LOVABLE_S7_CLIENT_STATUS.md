# Sessao 7: Coluna `status` em `clients`

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/client-status-column`
Issue: #54

Leia CONTEXT.md antes de comecar.

---

## OBRIGATORIO

1. Criar migration com coluna `status TEXT NOT NULL DEFAULT 'ativo'` na tabela `clients`
2. Adicionar CHECK constraint: `status IN ('ativo', 'inativo', 'trial')`
3. Popular clientes existentes: `UPDATE clients SET status = CASE WHEN active = true THEN 'ativo' ELSE 'inativo' END`
4. SQL idempotente: usar `IF NOT EXISTS` para a coluna, `DO $$ ... END $$` para o UPDATE condicional
5. Manter a coluna `active` intacta — NAO remover, NAO alterar
6. Manter o comportamento de `process-jobs` L343 que seta `active = false` apos 90 dias stale em clientes `auto_created` exatamente como esta — NAO adicionar logica de `status` nesse path
7. Regenerar `types.ts` apos a migration para que o frontend veja a coluna `status`

## PROIBIDO

1. NAO alterar `sync-gist-contacts` nem `process-jobs` — eles ja nao conhecem a coluna `status` e DEVEM continuar sem conhecer
2. NAO alterar `deactivate_stale_clients()` — ela opera em `active`, NAO em `status`
3. NAO remover a coluna `active`
4. NAO criar trigger, cron ou funcao que altere `status` automaticamente
5. NAO criar Edge Function para alterar `status`
6. NAO alterar RLS policies existentes
7. NAO alterar `user_accessible_client_ids()` — ela nao filtra por `active` nem por `status`
8. NAO usar `unnest()` em nenhum contexto — `user_accessible_client_ids()` retorna `SETOF uuid`, cada row ja e uuid escalar
9. Se qualquer duvida surgir, PARE e pergunte ao Operador. NAO tome decisoes autonomamente

---

## Problema

A tabela `clients` tem `active BOOLEAN` controlado pelo sync automatico do Gist. Isso mistura dois conceitos: presenca no canal (sync) e situacao real do cliente perante a uMode (decisao do Operador).

Clientes atendidos fora do Gist (ex: WhatsApp) somem do dashboard por nao terem interacoes no Gist.

Solucao: coluna `status` de controle 100% manual, independente de `active`.

---

## SQL literal

```sql
-- Migration: adicionar coluna status em clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo';

    ALTER TABLE public.clients
      ADD CONSTRAINT clients_status_check
      CHECK (status IN ('ativo', 'inativo', 'trial'));

    -- Popular baseado no active atual
    UPDATE public.clients
    SET status = CASE
      WHEN active = true THEN 'ativo'
      WHEN active = false THEN 'inativo'
      ELSE 'ativo'
    END;
  END IF;
END $$;
```

---

## Verificacao pos-deploy

Executar estas queries e colar o resultado de volta para o Operador:

```sql
-- 1. Coluna existe?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'status';
-- Esperado: status | text | 'ativo'::text

-- 2. Constraint CHECK existe?
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'clients'::regclass AND contype = 'c';
-- Esperado: clients_status_check | CHECK ((status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'trial'::text])))

-- 3. Populacao correta?
SELECT status, count(*) FROM clients GROUP BY status ORDER BY status;
-- Esperado: ativo = (quantidade de active=true), inativo = (quantidade de active=false)

-- 4. types.ts regenerado?
-- Verificar que src/integrations/supabase/types.ts contem "status" na definicao de clients
```

---

## Frontend Contract

```
Coluna: clients.status TEXT NOT NULL DEFAULT 'ativo'
Valores: 'ativo' | 'inativo' | 'trial'
Controle: 100% manual (Operador via SQL ou UI futura)
Nunca alterado por sync, edge function, cron ou trigger

Queries frontend devem migrar de:
  .eq("active", true)
para:
  .in("status", ["ativo", "trial"])     -- filtro default (lista, dropdowns)
  sem filtro de status                  -- quando toggle "incluir inativos" ativo

Arquivos impactados no frontend (4):
  - ClientsPage.tsx L160
  - SearchPage.tsx L80
  - SettingsPage.tsx L115
  - GistContactWizard.tsx L108
```
