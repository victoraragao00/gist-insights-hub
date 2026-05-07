# LOVABLE HOTFIX — CTX6: `deactivate_stale_clients` SECURITY DEFINER sem `is_admin()` guard

> **Tipo:** Hotfix de segurança · **Severidade:** ALTA · **Bloqueador para produção**
> **Origem:** Auditoria Claude Code do burst 2026-04-09→2026-05-07 — `auditorias/AUDITORIA_20260507.md` item CTX6
> **Pendência:** `auditorias/PENDENTES.md` linha CTX6

---

## Cabeçalho

| Campo | Valor |
|---|---|
| **Repositório** | https://github.com/HyTrackWater/gist-insights-hub |
| **Prioridade** | 🚨 ALTA — corrigir antes de qualquer feature nova |
| **Dependências** | Nenhuma. A função `is_admin()` já existe no banco (referenciada em outras policies/RPCs). |
| **Aplicar via** | Lovable migration tool (gera nova migration SQL no `supabase/migrations/`) |

---

## Problema

A função `deactivate_stale_clients(_days integer)` é `SECURITY DEFINER` e desativa clientes em massa via `UPDATE clients SET active = false WHERE ...`. Tem proteções (filtra `auto_created='true'` + triple `NOT EXISTS` em interactions/demands/meeting_agendas) — porém **não tem guard `is_admin()` no início**.

Sem `GRANT ... TO admin` explícito ou check interno, qualquer authenticated user pode invocar via:

```ts
await supabase.rpc("deactivate_stale_clients", { _days: 1 });
```

E desativar centenas de clientes auto-criados. Em prod com 1 operador (Victor) o risco operacional é baixo, mas é vulnerabilidade real — e o pattern do projeto exige `is_admin()` em qualquer SECURITY DEFINER que muta dados.

**Atual:** `supabase/migrations/20260504131751_cd355042-a614-49a8-95e3-db0107e59d99.sql`

---

## OBRIGATÓRIO

1. Criar nova migration que faz `CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)` exatamente com o SQL abaixo (seção "SQL").
2. Manter assinatura idêntica: `(_days integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
3. Manter o corpo do `UPDATE` IGUAL — não mexer nas condições `WHERE`. **Adicionar apenas** o bloco `IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;` no início.
4. Adicionar `COMMENT ON FUNCTION` documentando que a função é admin-only.
5. Rodar as queries de Verificação abaixo após deploy e colar os resultados na thread.

## PROIBIDO

1. **Não** alterar a assinatura, o tipo de retorno (integer com row_count), o nome da função ou o `SECURITY DEFINER`.
2. **Não** alterar as condições do `UPDATE` (filtros `auto_created`, `last_seen_at`, triple `NOT EXISTS`).
3. **Não** alterar `is_admin()` em si — usá-la como existe.
4. **Não** alterar nenhuma outra função, tabela, policy ou RPC.
5. **Não** usar `auth.jwt() ->> 'role' = 'admin'` ou outro mecanismo — o pattern canônico do projeto é `is_admin()`.
6. **Não** revogar EXECUTE de `authenticated` (a Edge Function/UI futuras podem precisar invocar; o guard interno é suficiente e mais explícito).

---

## SQL (copiar na íntegra para a migration)

```sql
-- Hotfix CTX6: deactivate_stale_clients agora exige is_admin() no início.
-- Antes: qualquer authenticated user podia invocar via supabase.rpc(...) e desativar clientes em massa
--        (mesmo com filtros auto_created/NOT EXISTS, é privilégio que não pertence a non-admin).
-- Agora: RAISE EXCEPTION 'Admin only' antes do UPDATE.

CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE clients c
  SET active = false
  WHERE c.active = true
    AND c.metadata->>'auto_created' = 'true'
    AND (c.metadata->>'last_seen_at')::timestamptz < NOW() - make_interval(days => _days)
    AND NOT EXISTS (SELECT 1 FROM interactions i      WHERE i.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM demands d           WHERE d.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM meeting_agendas m   WHERE m.client_id = c.id);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.deactivate_stale_clients IS
  'Desativa clients auto_created sem trabalho associado e com last_seen_at > _days dias. SECURITY DEFINER, admin-only via is_admin() guard. Retorna row_count.';
```

---

## Verificação (rodar APÓS deploy)

### 1. Confirmar que admin consegue invocar (dry run com _days alto)

```sql
-- Logado como admin (global_role='admin')
-- Usa _days = 99999 para garantir 0 affected (smoke test sem efeito real)
SELECT public.deactivate_stale_clients(99999);
-- Esperado: retorna 0 (nenhum client tem last_seen_at < now() - 99999d)
```

### 2. Confirmar que non-admin é bloqueado

```sql
-- Logado como user com global_role != 'admin' AND bypass_client_access = false
-- (criar user temporário se necessário)
SELECT public.deactivate_stale_clients(99999);
-- Esperado: ERROR: Admin only
```

### 3. Validar que a lógica de negócio continua intacta

```sql
-- Antes da invocação real (sempre como admin), conferir candidatos:
SELECT c.id, c.name, c.metadata->>'last_seen_at' AS last_seen
FROM clients c
WHERE c.active = true
  AND c.metadata->>'auto_created' = 'true'
  AND (c.metadata->>'last_seen_at')::timestamptz < NOW() - make_interval(days => 90)
  AND NOT EXISTS (SELECT 1 FROM interactions i      WHERE i.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM demands d           WHERE d.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM meeting_agendas m   WHERE m.client_id = c.id);

-- Depois invocar (ainda como admin):
-- SELECT public.deactivate_stale_clients(90);
-- Esperado: row_count == número de candidatos da query acima.
```

### 4. Confirmar que a função `is_admin()` está acessível e funcionando

```sql
SELECT public.is_admin();
-- Logado como admin: true
-- Logado como non-admin: false
```

---

## Rollback

A migration anterior (`20260504131751_cd355042-a614-49a8-95e3-db0107e59d99.sql`) tem o corpo original sem o guard. Reverter via `CREATE OR REPLACE FUNCTION` apontando para aquele corpo. **Não recomendado** — só em caso de bug de comportamento.

---

## Notas

- **Decisão CTX21 pendente:** a auditoria identificou inconsistência entre esta função (usa `active=false`) e o cleanup manual de 2026-05-04 (que usou `status='inativo'` + flag `cleanup_2026_05_inactivated`). Esta hotfix **não** resolve essa inconsistência — é só sobre o guard de admin. Decidir o pattern oficial em conversa separada com o time.
- **Por que `is_admin()` e não checar `bypass_client_access`?** Porque `bypass_client_access` libera o usuário a *ver* dados de todos os clientes — não a *desativar* clientes. Privilégio destrutivo deve permanecer restrito ao `global_role='admin'`.
