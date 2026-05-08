## Documentos + Backlog de Tópicos em Projetos

Duas adições à página de Projeto, ambas para registrar trabalho **antes** de virar demanda formal no Kanban.

---

### Parte A — Aba "Documentos"

Reuso direto do padrão `client_documents` + bucket `client-documents` + `RichTextEditor` (mesmo editor usado nas demandas, com colar imagem).

**Banco** — nova tabela `project_documents`:
- `project_id` (FK `projects.id` ON DELETE CASCADE)
- `title`, `category` (`escopo` | `entregavel` | `nota` | `outro`)
- `description` (HTML do RichTextEditor, suporta imagens inline)
- `url` (link externo opcional)
- `file_path`, `file_name`, `file_size_bytes`, `mime_type` (para anexos)
- `created_by`, `created_at`, `updated_at`

RLS: owner do projeto **ou** membro em `project_members` pode SELECT/INSERT/UPDATE/DELETE.

Storage: bucket privado `project-documents` com policies espelhando o RLS (path `<project_id>/...`). Imagens inline coladas no editor vão em `<project_id>/inline/...`.

**Hook** `src/hooks/useProjectDocuments.ts` — cópia de `useClientDocuments.ts` (queries, create/update/delete, upload com cleanup).

**UI** — novo componente `ProjectDocumentsTab.tsx`:
- Lista por categoria com botões "Novo documento" (abre dialog com `RichTextEditor`) e "Anexar arquivo" (file picker direto).
- Dialog de detalhe: Título, Categoria (select), URL externa, Conteúdo rich-text.
- Cada item mostra ícone (📄 escrito / 📎 arquivo), título, badge de categoria, autor, data; clique abre detalhe; ações Salvar/Excluir.

---

### Parte B — Aba "Backlog" (tópicos pré-demanda)

Lugar leve para listar coisas que **vão virar demanda**, sem entrar no Kanban ainda. Ao maturar, um clique converte em demanda real.

**Banco** — nova tabela `project_backlog_items`:
- `project_id` (FK `projects.id` ON DELETE CASCADE)
- `title` (texto curto)
- `notes` (HTML rich-text, opcional — também aceita imagens coladas)
- `status` (`open` | `converted` | `discarded`, default `open`)
- `position` (int, para reordenar)
- `converted_demand_id` (FK `demands.id` ON DELETE SET NULL, preenchido ao converter)
- `converted_at`, `created_by`, `created_at`, `updated_at`

RLS idêntica a `project_documents` (owner ou member do projeto).

**Hook** `src/hooks/useProjectBacklog.ts`:
- `useProjectBacklog(projectId)` — lista por `position`, com filtro de status.
- `useCreateBacklogItem`, `useUpdateBacklogItem`, `useDeleteBacklogItem`, `useReorderBacklogItems`.
- `useConvertBacklogToDemand(projectId)` — abre `CreateDemandDialog` pré-preenchido (título + notas → descrição) com `project_id` fixo. Após criar com sucesso, atualiza o item: `status='converted'`, `converted_demand_id=<id>`, `converted_at=now()`.

**UI** — novo componente `ProjectBacklogTab.tsx`:
- Visual estilo lista de tarefas (similar a `demand_tasks`): linha com checkbox/handle, título inline-editável, ícone para abrir notas, badge de status, menu `⋯`.
- Adicionar topo: input "Novo tópico" → Enter cria.
- Reordenar com drag (`@dnd-kit`, já no projeto).
- Por padrão mostra `open`; toggle para ver `converted` / `discarded`.
- Item já convertido mostra link "→ Ver demanda #X" (rota da demanda) e fica desabilitado para edição.
- Ação principal por item: **"Converter em demanda"** — abre o `CreateDemandDialog` existente em modo pré-preenchido (já recebe `project_id` por padrão; precisa expor props `defaultTitle` e `defaultDescriptionHtml` se ainda não existirem). Botão secundário: "Descartar".

**Integração com `CreateDemandDialog`:**
- Adicionar props opcionais: `defaultProjectId`, `defaultTitle`, `defaultDescriptionHtml`, `onCreated?(demandId)`.
- Sem mudança de comportamento para os fluxos atuais (props opcionais).
- A conversão usa `onCreated` para marcar o backlog item.

---

### Estrutura final da `ProjectDetailPage`

```text
[Demandas] [Backlog] [Documentos] [Reuniões] [Squad] [Atividade]
```

### Verificação

- Owner/membro do projeto consegue: criar tópicos no backlog, escrever notas com imagens, reordenar, converter em demanda (a demanda nasce vinculada ao projeto e o tópico marca `converted` com link).
- Documentos: criar nota escrita com imagem colada, anexar arquivo, editar, excluir.
- Não-membro não vê as abas e o RLS bloqueia chamadas diretas.
- Excluir o projeto remove documentos, backlog items e arquivos do bucket (FK CASCADE + cleanup no hook de delete).

### Detalhes técnicos

- Sem nova dependência (reuso de `RichTextEditor`, `@dnd-kit`, `CreateDemandDialog`, padrão `client_documents`).
- HTML do rich-text armazenado direto na coluna (mesmo padrão de demandas).
- `converted_demand_id` com `ON DELETE SET NULL` para não perder o histórico do tópico se a demanda for apagada.
- `position` reindexado em batch via mutation única ao reordenar.
