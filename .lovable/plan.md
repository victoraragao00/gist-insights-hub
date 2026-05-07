## Objetivo

Vincular pautas a projetos no `CreateAgendaDialog` e tornar o vínculo editável na `AgendaDetailPage`, com regras de compatibilidade por cliente.

## Mudanças

### 1. `src/components/agendas/CreateAgendaDialog.tsx`
- Remover restrição que só exibe o Select de Projeto quando `agendaType === "internal"`. Passar a exibir sempre.
- Atualizar `useCompatibleProjects` para receber também o `agendaType`:
  - `internal` → todos os projetos ativos (sem filtro de cliente).
  - `client` → projetos do mesmo `client_id` OU `is_internal=true`.
- `project_id` continua sendo enviado no insert (já existe).

### 2. `src/hooks/useMeetingAgendas.ts`
- `useMeetingAgenda`: incluir join `projects:project_id(id, title, is_internal)` no select.
- Estender `MeetingAgendaWithClient` com `project_id?: string | null` (já existe na tabela) e `projects?: { id; title; is_internal } | null`.
- `agenda_type` tipado como `"client" | "internal"` no retorno (cast onde necessário).

### 3. `src/pages/AgendaDetailPage.tsx`
- A página não tem sidebar; o vínculo de projeto será exibido na **meta row** do Header Card (ao lado de cliente/data/local/duração), seguindo o mesmo padrão visual editável inline.
- Novo subcomponente `AgendaProjectField` (no mesmo arquivo) com:
  - `useCompatibleProjects(agenda.client_id, agenda.agenda_type)` (hook compartilhado — ver passo 4).
  - `useMutation` que faz `update meeting_agendas set project_id` e invalida `["meeting_agenda", id]` + `["meeting_agendas"]`.
  - Quando vinculado: badge "Interno" (se aplicável) + título clicável navegando para `/projects/:id` com ícone `ExternalLink` + botão `X` para desvincular.
  - Quando vazio: Select inline com placeholder "Vincular projeto...".
  - Toasts via `sonner` ("Projeto atualizado" / erro).

### 4. Hook compartilhado `useCompatibleProjects`
- Extrair `useCompatibleProjects` para `src/hooks/useProjects.ts` (já abriga hooks de projetos) e reutilizar tanto no `CreateAgendaDialog` quanto no `AgendaDetailPage`.
- Assinatura: `useCompatibleProjects(clientId?: string | null, agendaType?: "client" | "internal")`.

## Padrões / Checklist

- m9: toda escrita via `useMutation` (criar e atualizar).
- m11: remover imports não usados após o refactor (ex.: `useQuery` solto no Dialog, se sair).
- m8: destructurar `{ error }` em todas as queries/mutations.
- m4/m5: `staleTime: 60_000`, `queryKey` inclui `clientId` + `agendaType`.
- m3: apenas `sonner`.
- Sem novas migrations — `project_id` já existe em `meeting_agendas`.
- Não tocar em `src/integrations/supabase/*`, `supabase/migrations/*`, `.env`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`.

## Verificação manual

1. Criar pauta de cliente X → Select mostra apenas projetos de X + internos.
2. Criar pauta interna → Select mostra todos os projetos ativos.
3. Salvar pauta com projeto → vínculo persistido.
4. AgendaDetailPage exibe campo Projeto editável; alterar dispara toast.
5. Pauta com projeto: link navega para `/projects/:id`; botão `X` desvincula.
