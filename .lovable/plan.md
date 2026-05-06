## Plano — Sidebar unificado, RFIs page, Projetos compartilhados

### Escopo confirmado (4 features)

**F1. Sidebar unificado (`src/components/AppSidebar.tsx`)**
- Itens exclusivos por workspace:
  - TECH: Dashboard (`/tech/dashboard`), Kanban (`/demands`)
  - CX: Dashboard (`/`), Demandas (`/demands`), Analytics (`/demands/dashboard`)
- Divisor + grupo "Geral" (igual nos dois workspaces): Projetos · Clientes · Pautas · RFIs
- Path de Pautas dinâmico: TECH → `/agendas?type=internal`, CX → `/agendas?type=client`
- Manter Busca/Auditorias do CX dentro do grupo do workspace (não estavam no prompt; manter como itens CX-only para não regredir)
- Configurações + Sair no `SidebarFooter` (já existe)

**F2. AgendasPage com filtro por workspace (`src/pages/AgendasPage.tsx`)**
- Ler `?type=` da URL e workspace ativo; default = `internal` em TECH, `client` em CX
- Adicionar toggle pill "Externas / Internas / Todas" no topo dos filtros
- Sincronizar mudança do toggle com `setSearchParams` para deep-linking
- Passar `agendaType` ao hook `useMeetingAgendas` (campo `agenda_type` já existe na tabela)
- Verificar se `useMeetingAgendas` aceita filtro por tipo; se não, estender o hook (apenas leitura, m4 staleTime mantido)

**F3. RFIsPage nova (`/rfis`)**
- Nova rota em `src/App.tsx` (dentro do `ProtectedRoute` + `ClientProvider` + `ErrorBoundary`)
- Hook `useAllRfis(filters)` em `src/hooks/useRfis.ts` (`staleTime: 30_000`, queryKey inclui `user?.id` + filtros conforme regra de cache)
- Tabela com colunas: Código (`rfi_number`), Demanda, Cliente, Status, Responsável, Criado
- Filtros: busca por `rfi_number`, status (via `rfi_statuses`), cliente
- Click na linha → `navigate('/demands/:demand_id')`
- Item "RFIs" adicionado ao grupo Geral do sidebar

**F4. Projetos compartilhados + flag "Interno"**
- `useProjects`: remover `.eq('workspace', ...)` para projetos aparecerem em ambos workspaces
- `ProjectsPage` acessível sem amarração de workspace (rota já é `/projects`)
- `CreateProjectDialog`: substituir Select de cliente por `Switch` "Projeto interno (uMode)" + `ClientSelect` condicional; badge roxo "Interno" quando ativo
- `ProjectCard` + `ProjectDetailPage`: badge roxo "Interno" no header; ocultar nome do cliente quando interno

### ⚠️ Bloqueio detectado — confirmar antes de codar

O prompt diz "Dependências: Banco PROJECTS_RFI_SHARED concluído", mas inspeção do schema atual mostra que **a migration ainda NÃO foi aplicada**:

- Tabela `projects` **não tem coluna `is_internal`** (colunas atuais: id, title, description, owner_id, due_date, cancelled_at, cancelled_by, workspace, client_id, created_at, updated_at)
- Tabela `rfis` **não tem coluna `status` (string)** — usa `status_id` (FK para `rfi_statuses`)
- Tabela `rfis` **não tem coluna `code`** — código da RFI é `rfi_number`

Como o prompt proíbe migration nesta sessão, propõe-se:

1. **F4 — Badge "Interno":** ao salvar `is_internal`, gravar em `clients = null` e usar **`is_internal = (client_id === null && workspace === 'tech')`** como derivação visual até a coluna existir. UI fica pronta, basta a migration depois para persistir explicitamente.
2. **F3 — RFIs:** usar `rfi_number` em vez de `code`; filtro de status por `status_id` com join em `rfi_statuses(name, color)` (já existe pattern em `useRfisByClient`).

### Arquivos a alterar/criar

- `src/components/AppSidebar.tsx` — reorganizar grupos
- `src/pages/AgendasPage.tsx` — toggle + searchParams + filtro
- `src/hooks/useMeetingAgendas.ts` — aceitar `agendaType` no filter (verificar se já existe)
- `src/hooks/useRfis.ts` — adicionar `useAllRfis`
- `src/pages/RFIsPage.tsx` — novo
- `src/App.tsx` — adicionar rota `/rfis`
- `src/hooks/useProjects.ts` — remover filtro de workspace na listagem (manter no insert)
- `src/components/projects/CreateProjectDialog.tsx` — Switch + condicional
- `src/components/projects/ProjectCard.tsx` — badge "Interno"
- `src/pages/ProjectDetailPage.tsx` — badge "Interno" no header

### Conformidade Checklist CTO
- m4: todas queries com `staleTime` (30s para listas dinâmicas, 5min para projetos)
- m5: `queryKey` inclui `user?.id` + filtros
- m8: `{ data, error }` destructurado
- m11: zero imports não usados
- Toasts via `sonner` (já é o padrão)

### Pergunta para o usuário (antes de implementar)

Como tratar `is_internal` sem a coluna no banco?
- **(a) Implementar UI completa, persistir como `client_id = null`** e detectar "interno" como `client_id === null && workspace === 'tech'` (recomendado — entrega 100% do visual hoje, migration depois marca explicitamente)
- **(b) Pausar F4 até criar a migration** (`ALTER TABLE projects ADD COLUMN is_internal boolean DEFAULT false`) em sessão separada
- **(c) Criar a migration nesta sessão mesmo** (viola "Não criar migration nesta sessão" do prompt)
