## Contexto

A migration `is_internal` foi aplicada no banco. O frontend já tem a maior parte das features (sidebar unificado, RFIsPage, useProjects sem filtro de workspace, dialog com toggle). Falta apenas **persistir e ler `is_internal` nativo** em vez da derivação `client_id === null && workspace === 'tech'`.

## Mudanças

### 1. `src/hooks/useProjects.ts`
- Adicionar `is_internal: boolean` em `ProjectRow`.
- Adicionar `PROJECT_SELECT` para incluir `is_internal`.
- `CreateProjectInput`: aceitar `is_internal?: boolean`.
- `useCreateProject`: como o RPC `create_project` não aceita `p_is_internal` (e não podemos criar migration nesta sessão), executar um `update` em sequência logo após o RPC quando `is_internal === true`. A constraint `chk_internal_no_client` garante consistência (client_id já será null no payload).

### 2. `src/components/projects/CreateProjectDialog.tsx`
- Passar `is_internal: isInternal` no `mutateAsync`.

### 3. `src/components/projects/ProjectCard.tsx`
- Trocar `!project.client_id && project.workspace === "tech"` por `project.is_internal` no badge "Interno".
- Trocar `project.clients && project.client_id` por `project.clients && !project.is_internal` na linha do cliente.

### 4. `src/pages/ProjectDetailPage.tsx`
- Mesma troca: badge "Interno" usa `project.is_internal`; bloco de cliente esconde quando `is_internal === true`.

## Verificação

1. Criar projeto com toggle "Interno" ligado → registro com `is_internal=true` e `client_id=null`.
2. Card e detalhe exibem badge roxo "Interno" sem nome de cliente.
3. Projeto externo continua mostrando cliente normalmente.
4. Constraint do banco bloqueia inconsistência (testado na migration anterior).
