## Problema

Hoje **230 de 243 clientes** foram criados automaticamente, e quase todos usam o **domínio do email** como nome (ex: `loftystyle.com.br`, `aluno.ufsj.edu.br`, `yahoo.com`, `mclknit.com`). Isso polui a lista de Clientes e cria entidades sem valor de negócio.

O Gist já tem o campo **`Company name`** como propriedade default do contato (visível em "Qualification → Company name", ex: "NK Store"). Esse é o campo correto para ser usado como nome do cliente.

Diagnóstico do código atual:

1. `gist-discover` (wizard de mapeamento) lê `contact.company_name` como campo raiz — **errado**. Por isso o wizard nunca mostra a empresa real, só o domínio.
2. `process-jobs → handleSyncContacts` lê `contact.custom_properties?.company_name` — também provavelmente errado (no Gist, `company_name` é uma **default property**, não custom). Mesmo quando estiver presente, o fallback sempre cai no domínio do email — e é esse fallback que está criando todos os 230 clientes-lixo.
3. Domínios genéricos (yahoo.com, zoho.com) escapam do filtro porque ele só compara em minúsculas e sem trims robustos — mas mesmo assim foram criados antes (ex: `yahoo.com`, `zoho.com`).

## Objetivo

Mudar a fonte de verdade para criação/agrupamento de clientes:
**1º** `company_name` do contato no Gist · **2º** matching com cliente existente por domínio · **3º** quarentena (sem criar cliente) — nunca mais criar cliente a partir do domínio.

## Mudanças

### 1. Edge Function `gist-discover` (agrupamento do wizard)

- Corrigir leitura: `contact.company_name` (campo raiz é o correto pela doc oficial do Gist) **+** fallback para `contact.custom_properties?.company_name` por segurança.
- **Mudar a chave de agrupamento de `domain` para `company_name`** quando disponível. Quando ausente, manter agrupamento por domínio (comportamento atual) para compatibilidade do wizard.
- Adicionar contagem `contacts_without_company` no payload de retorno para o wizard exibir.
- Manter o filtro de domínios genéricos.

### 2. Edge Function `process-jobs → handleSyncContacts`

Nova lógica de resolução de cliente para cada contato (em ordem):

1. **`company_name` presente** (raiz do contato OU `custom_properties.company_name`):
   - `name = company_name.trim()`, `slug = toSlug(company_name)`.
   - `findOrCreateClient(name, slug)` — cria com `metadata.source = 'gist_sync_company_name'`.
2. **Sem `company_name`, com email** (não-genérico):
   - **Tentar matchar com cliente existente** (manual ou já mapeado) por similaridade de domínio.
   - **Se matchar**: vincular participante ao cliente existente.
   - **Se NÃO matchar**: **quarentenar** (`upsertParticipant(contact, null)` + `contactsUnresolved++`). **Não criar mais clientes a partir de domínio.**
3. **Sem `company_name` e sem email útil**: quarentena.

Ampliar `GENERIC_DOMAINS` para incluir provedores que já vazaram (`zoho.com`, `yahoo.com.br`, etc.) — lista revisada com base no banco atual.

### 3. Migration de limpeza (clientes auto_created sem valor)

Migration manual + idempotente:

- Identificar clientes com `metadata->>'auto_created' = 'true'` AND `metadata->>'source' = 'gist_sync'` AND **sem demandas, sem agendas, sem RFIs vinculados** AND `slug` parecendo domínio (regex `\.(com|net|org|br|io|co|app|dev|tech)$` ou contém ponto).
- Para cada um:
  - Se tiver participantes, **desvincular** (`participants.client_id = NULL`) — vão para quarentena.
  - **Marcar como `inactive`** (não deletar) — preserva histórico e respeita o protocolo de soft delete da CTO.
- Gerar `auditorias/AUDITORIA_GIST_CLIENT_CLEANUP_YYYYMMDD.md` listando antes/depois.

A migration **não** toca em clientes manuais (13 atuais) nem em clientes auto_created que já tenham demandas/agendas/RFIs (preserva trabalho real feito sobre eles).

### 4. UI: `GistContactWizard.tsx`

- Exibir `company_name` (quando disponível) como label principal de cada grupo, com o domínio em segundo plano.
- Quando o grupo veio de `company_name` (não de domínio), o sufixo `· {company}` some e vira o título.
- Botão "Quarentenar todos sem company" como ação em massa quando o usuário não quiser criar/mapear contatos sem empresa identificada.

### 5. Documentação

Atualizar `mem://constraints/gist-sync-generic-domains` e adicionar nova memória `mem://features/gist-company-name-priority` documentando a nova prioridade de resolução.

## Não fazer

- **Não deletar clientes** — apenas inativar (preserva integridade relacional e histórico).
- **Não tocar** em clientes manuais ou em clientes com demandas/agendas/RFIs vinculados.
- **Não alterar** `src/integrations/supabase/*`, `supabase/config.toml` ou auth flows.
- **Não criar** clientes a partir de domínio nunca mais — domínio só serve para match com cliente já existente.

## Detalhes técnicos

```text
Pipeline novo (process-jobs handleSyncContacts):

contact
  ├─ tem company_name? ──► CRIA/REUSA cliente por slug(company_name)
  └─ não tem company_name?
       ├─ tem email não-genérico? ──► tenta match com cliente existente por domínio
       │     ├─ matchou? ──► vincula participante
       │     └─ não matchou? ──► quarentena (participant.client_id = NULL)
       └─ sem email útil? ──► quarentena
```

Campos do Gist confirmados pela doc oficial (`docs.getgist.com/article/241`):
- `company_name` — propriedade DEFAULT do contato (raiz do payload).
- `custom_properties.company_name` — só existe se o workspace tiver custom property com mesmo nome (fallback).

Arquivos alterados:
- `supabase/functions/gist-discover/index.ts`
- `supabase/functions/process-jobs/index.ts` (apenas `handleSyncContacts`)
- `src/components/GistContactWizard.tsx`
- Nova migration `supabase/migrations/{ts}_inactivate_domain_only_auto_clients.sql`
- `auditorias/AUDITORIA_GIST_CLIENT_CLEANUP_{YYYYMMDD}.md`
- `mem://features/gist-company-name-priority` (novo)
- `mem://constraints/gist-sync-generic-domains` (atualizado)

## Critérios de aceitação

1. Após próximo sync, novos contatos com `company_name` no Gist viram clientes com o nome da empresa (ex: "NK Store"), não com domínio.
2. Contatos sem `company_name` e sem cliente existente que case por domínio ficam em quarentena (`participants.client_id = NULL`) e não criam cliente.
3. Lista de Clientes deixa de mostrar entradas como `loftystyle.com.br`, `aluno.ufsj.edu.br`, `yahoo.com`, etc. (vão para inativo, ocultos pelo filtro default).
4. Wizard de mapeamento mostra "NK Store" no lugar de "nkstore.com.br" quando o Gist tiver a empresa preenchida.
5. Nenhum cliente manual ou cliente com demandas/agendas/RFIs é tocado.
