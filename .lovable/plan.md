## Objetivo

Corrigir o efeito colateral da limpeza anterior (PUKET inativado por engano) e ajustar o critério de proteção para que clientes com interações reais não sejam mais inativados em futuras execuções.

## Diagnóstico

| Cliente | Status atual | Demandas | Agendas | Interações | Motivo |
|---------|--------------|----------|---------|------------|--------|
| `loftystyle.com.br` | **Ativo** | 51 | 67 | 1.297 | Protegido por ter demandas/agendas |
| `puket.com.br` | **Inativo** | 0 | 0 | 61 | Removido — interações sozinhas não eram critério |

A regra anterior só protegia clientes com demandas/agendas/RFIs. Interações (mesmo 61) não contavam.

## Ações

### 1. Migration: reativar PUKET e ajustar critério de proteção

```sql
-- Reativar PUKET (tem 61 interações reais)
UPDATE clients
SET active = true
WHERE id = '12abfda9-f8a2-48e5-ac9c-a23350c4f2d2';

-- Reativar quaisquer outros clientes inativados na limpeza anterior
-- que tinham interações (segurança retroativa)
UPDATE clients c
SET active = true
WHERE c.active = false
  AND c.metadata->>'auto_created' = 'true'
  AND EXISTS (SELECT 1 FROM interactions i WHERE i.client_id = c.id);
```

### 2. Atualizar `deactivate_stale_clients` para preservar interações

Atualmente a função inativa por `last_seen_at` antigo sem checar interações. Vou adicionar uma cláusula que **nunca** inativa um cliente que tenha qualquer interação, demanda, agenda ou RFI vinculados.

```sql
CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  UPDATE clients c
  SET active = false
  WHERE c.active = true
    AND c.metadata->>'auto_created' = 'true'
    AND (c.metadata->>'last_seen_at')::timestamptz < NOW() - make_interval(days => _days)
    AND NOT EXISTS (SELECT 1 FROM interactions i  WHERE i.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM demands d       WHERE d.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM meeting_agendas m WHERE m.client_id = c.id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
```

### 3. Renomear LOFTY manualmente

```sql
UPDATE clients
SET name = 'Lofty Style'
WHERE id = 'a33f0682-fbeb-41cd-88d4-a54aed4a883e';
```

> Slug fica `loftystyle-com-br` (não altero para não quebrar links existentes). O nome exibido na UI passa a ser "Lofty Style".

### 4. Atualizar memória

Atualizar `mem://tech/client-inactivation-safety-logic` com o novo critério: clientes auto-criados só são inativados se não tiverem **nenhuma** interação, demanda ou agenda.

## Sobre PUKET no futuro

Mantemos a decisão "Aceitar como está": quando o Gist enviar `company_name = "puket.com.br"`, o cliente continuará sendo criado com esse nome e você renomeia manualmente. Como agora há proteção por interações, ele não será mais inativado por engano.

## Arquivos afetados

- Migration nova (1 arquivo): reativação + redefinição de função + rename
- `mem://tech/client-inactivation-safety-logic` (atualização de memória)

## Validação pós-execução

```sql
SELECT id, name, active FROM clients
WHERE id IN (
  '12abfda9-f8a2-48e5-ac9c-a23350c4f2d2',  -- PUKET deve estar ativo
  'a33f0682-fbeb-41cd-88d4-a54aed4a883e'   -- LOFTY deve aparecer como "Lofty Style"
);
```

PUKET volta a aparecer na listagem de clientes na UI imediatamente após a migration.
