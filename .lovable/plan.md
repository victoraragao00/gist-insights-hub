## Três pendências em Projetos

### 1. Status do Backlog (4 estados) com transições manuais

Hoje o backlog tem 3 estados (`open`, `converted`, `discarded`). Vamos renomear/expandir para 4:

| Novo status | Quando | Origem (migração) |
|---|---|---|
| `aguardando_priorizacao` | Tópico ainda não virou demanda | mapeia de `open` |
| `aberto` | Existe demanda vinculada | mapeia de `converted` (já tem `converted_demand_id`) |
| `concluido` | Resolvido sem demanda (ou marcado manualmente como pronto) | novo |
| `cancelado` | Não vai acontecer | mapeia de `discarded` |

**Regras de transição**
- Criar tópico → `aguardando_priorizacao`
- "Converter em demanda" → `aberto` + grava `converted_demand_id` (já existe)
- Menu `⋯` permite mover livremente entre os 4 (com confirmação ao "Cancelar" e ao limpar status de um item já convertido)
- Filtros de aba: `Aguardando priorização` (default) · `Aberto` · `Concluído` · `Cancelado` · `Todos`
- Cores: aguardando = muted, aberto = primary suave, concluído = emerald, cancelado = muted/line-through

**Backend**
- Migration: `ALTER TABLE project_backlog_items` — atualizar CHECK constraint para os 4 novos valores; `UPDATE` em massa para remapear (`open→aguardando_priorizacao`, `converted→aberto`, `discarded→cancelado`); mudar default para `aguardando_priorizacao`.
- Hook `useProjectBacklog.ts`: atualizar tipo `BacklogStatus`, ajustar `useMarkBacklogConverted` (status `aberto`), expor `useSetBacklogStatus`.

### 2. Editar Cliente e Owner em projeto já criado

No sidebar de `ProjectDetailPage`, transformar as linhas **Owner** e **Cliente** em campos editáveis (apenas para o `isOwner === true`, igual aos outros campos).

- **Owner**: `Combobox` com `user_profiles` (mesma fonte do `UserSelect`). Ao salvar, `UPDATE projects SET owner_id`. Registra atividade.
- **Cliente**: `Combobox` com clientes acessíveis (mesma fonte de `CreateProjectDialog`). Ao salvar, `UPDATE projects SET client_id`. Avisa via `AlertDialog` que mudar o cliente **não move demandas/backlog/documentos já existentes** — eles permanecem com o cliente anterior (apenas novos itens herdam o novo). Registra atividade.

Hook: adicionar `useUpdateProject` (já pode existir parcialmente — reaproveitar) com campos `owner_id` e `client_id`.

### 3. Visualização agrupada por cliente em `/projects`

Em `ProjectsPage`, adicionar toggle ao lado dos filtros de status:

```
[ Lista ] [ Agrupado por cliente ]
```

- **Lista** (atual): grid de cards.
- **Agrupado**: para cada cliente (ordem alfabética, "Internos" no fim), uma seção colapsável com header `Nome do cliente · N projetos` e o grid de cards dentro. Estado de colapso por cliente em `useState` local (default: aberto).
- Filtro por status continua aplicando dentro de cada grupo; clientes sem projetos no filtro são ocultados.
- Persistir preferência (lista vs agrupado) em `localStorage` chave `projects:viewMode`.

### Detalhes técnicos

- **Arquivos editados**:
  - `supabase/migrations/<ts>_backlog_status_v2.sql` (CHECK + UPDATE + DEFAULT)
  - `src/hooks/useProjectBacklog.ts` (tipos + novo hook de status)
  - `src/components/projects/tabs/ProjectBacklogTab.tsx` (filtros, badges, menu de status)
  - `src/hooks/useProjects.ts` (mutation update owner/client)
  - `src/pages/ProjectDetailPage.tsx` (sidebar editável)
  - `src/pages/ProjectsPage.tsx` (toggle + agrupamento)
- **Sem dependências novas.**
- **Verificação**: backlog migrado mantém todos os itens com status equivalentes; converter tópico em demanda continua funcionando e marca `aberto`; owner consegue trocar cliente/owner e a mudança aparece em Atividade; agrupamento mostra projetos do mesmo cliente juntos e respeita o filtro de status.