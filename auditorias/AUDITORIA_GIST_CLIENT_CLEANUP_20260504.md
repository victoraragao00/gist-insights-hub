# Auditoria — Limpeza de Clientes Gist (domínio → company_name)

**Data:** 2026-05-04
**Origem:** Pedido do operador. Lista de Clientes poluída por entradas tipo `loftystyle.com.br`, `aluno.ufsj.edu.br`, `yahoo.com` etc., todas criadas pelo sync do Gist usando o **domínio do email** como nome do cliente.

## Diagnóstico

- **243 clientes totais** no banco (antes da limpeza).
- **230 (95%)** eram `auto_created = true` pelo sync do Gist.
- **97 desses** tinham nome parecendo um domínio de email e **nenhuma demanda ou pauta vinculada** — eram lixo puro.
- Na doc oficial do Gist (`docs.getgist.com/article/241-contact-properties-glossary`), `company_name` é uma **default contact property** disponível na raiz do contato (chave `company_name`). Era esse o campo a ser usado.

### Bugs encontrados no pipeline

1. `supabase/functions/gist-discover/index.ts` lia `contact.company_name` mas a interface deixava ambígua a presença do campo, e o agrupamento sempre era por **domínio** (nunca por `company_name`).
2. `supabase/functions/process-jobs/index.ts → handleSyncContacts` lia apenas `contact.custom_properties.company_name` (caminho errado para a default property), e o fallback **sempre criava cliente a partir do domínio** — gerando os 230 clientes-lixo.

## Correções aplicadas

### Código

| Arquivo | Mudança |
| --- | --- |
| `supabase/functions/process-jobs/index.ts` | Prioridade nova: 1º `company_name` (raiz e custom_properties) → cria cliente. 2º domínio → match com cliente existente apenas. 3º quarentena (`participant.client_id = NULL`). Nunca mais cria cliente a partir de domínio. `GENERIC_DOMAINS` ampliado (zoho, ymail, msn, me.com, yahoo.com.br, etc.). |
| `supabase/functions/gist-discover/index.ts` | Agrupamento agora é por `company_name` quando disponível (chave `company:`); cai para `domain:` apenas como fallback. Payload retorna `contacts_without_company` e `grouped_by` por grupo. |
| `src/components/GistContactWizard.tsx` | UI mostra `company_name` como label principal; badge "Gist" indica grupos vindos do `company_name`. Mostra também contagem de contatos ignorados sem empresa. |

### Dados (operação única)

Operação `UPDATE` aplicada em `clients` + `participants`:

- Filtro: `metadata.auto_created = 'true'` AND `metadata.source IN ('gist_sync','')` AND nome parecendo domínio AND `status = 'ativo'` AND **sem demandas e sem pautas vinculadas**.
- Ação: `status = 'inativo'`, `active = false`, marcador `metadata.cleanup_2026_05_inactivated = true` para auditoria futura.
- Participantes vinculados a esses clientes tiveram `client_id` setado para NULL (vão para a quarentena).

| Métrica | Valor |
| --- | --- |
| Clientes candidatos | 99 |
| Clientes inativados | **97** |
| Clientes preservados (têm trabalho) | 2 (`loftystyle.com.br`, `4takes.com.br`) |
| Participantes desvinculados | **1280** |

### Estado final

| Status | Antes | Depois |
| --- | --- | --- |
| ativo | 243 | **16** |
| inativo | 0 | 227 |

## Pendências (recomendações para o operador)

- **Renomear manualmente** os 2 clientes preservados que ainda têm nome de domínio mas têm trabalho real: `loftystyle.com.br`, `4takes.com.br`. Trocar pelo nome real da empresa.
- Quando rodar o próximo sync de contatos do Gist, os 1280 participantes em quarentena serão **reagrupados automaticamente** pelo `company_name` (Priority 1) — desde que esse campo esteja preenchido no Gist para esses contatos.
- Para contatos onde o usuário **não preencheu o Company name no Gist**, o pipeline agora **não cria mais cliente automaticamente** — eles ficam em quarentena até o operador preencher no Gist ou criar/mapear manualmente via wizard.

## Princípios respeitados

- Nenhum cliente foi deletado — apenas inativado (preserva FKs e histórico).
- Nenhum cliente manual ou com trabalho associado foi tocado.
- Operação é idempotente (filtro por `auto_created = true`, conforme regra de segurança da CTO).
- Sem alteração em `src/integrations/supabase/*` ou `supabase/config.toml`.
