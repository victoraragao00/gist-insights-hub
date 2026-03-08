# Relatório: Estado UI/UX e Checklist CTO — CX Hub (Fase 5)

**Destinatário:** Projeto CX Hub / Mega Agente (calibração e estratégia)  
**Origem:** Claude Code (revisão e engenharia)  
**Data:** 2026-03-07  
**Contexto:** Análise de `src/pages/`, `src/components/`, CONTEXT.md e AGENTS.md. Nenhum código foi alterado.

---

## 1. Inventário — Páginas e componentes

### Páginas (`src/pages/`)

| Página | Descrição |
|--------|-----------|
| **Index** | Dashboard principal com KPIs do Gist (contatos, conversas abertas/fechadas, tags, teammates, segmentos) e card "Próximos passos" com links para Auditorias e Configurações. |
| **ClientsPage** | Listagem de clientes ativos com busca, ordenação (nome, interações 30d, tom, saúde, último contato), canais e ações (Novo Cliente, Importar, Desativar) — várias ações ainda "Em breve". |
| **ClientDetailPage** | Detalhe do cliente em abas: Visão Geral (KPIs, volume 14d, distribuição de tom, últimas não-ok), Interações (feed), Participantes, Canais, Documentos, Regras de Negócio, Configurações (SLA, alertas, zona de perigo). |
| **Audits** | Placeholder: título "Auditorias", descrição e CTA "Nova Auditoria" / "Criar primeira auditoria" sem funcionalidade. |
| **SettingsPage** | Abas Integrações (Gist, WhatsApp, etc.), Sincronização (opções, clientes, histórico de jobs, barra de progresso, agendamento automático, regra de inativação), Uploads (transcrições). Inclui GistContactWizard. |
| **LoginPage** | Formulário de login (email/senha) com validação (zod), link para Signup. |
| **SignupPage** | Cadastro (email, senha, confirmação), sucesso com "Verifique seu email" e link para Login. |
| **NotFound** | 404 com mensagem em inglês e link "Return to Home". |

### Componentes de aplicação (`src/components/`)

| Componente | Descrição |
|------------|-----------|
| **DashboardLayout** | Layout com sidebar, header (trigger), barra de progresso de sync e `<Outlet />`. |
| **AppSidebar** | Menu lateral (logo uMode), módulos (Dashboard, Clientes, Auditorias), rodapé (Configurações), colapsável. |
| **ProtectedRoute** | Redireciona para `/login` se não autenticado; exibe loading durante checagem. |
| **ErrorBoundary** | Error boundary em classe com mensagem e botão "Tentar novamente". |
| **KPICard** | Card de KPI com título, valor, ícone, subtítulo e estado de loading (skeleton). |
| **InteractionsFeed** | Feed de conversas por cliente: filtros (tom, período), busca, lista de conversas e painel de thread (desktop/sheet mobile). |
| **GistContactWizard** | Wizard em dialog para vincular contatos Gist a clientes (passos: Clientes → Contatos → Confirmação → Importação). |
| **NavLink** | Wrapper de `RouterNavLink` com suporte a `activeClassName` e `pendingClassName`. |

Componentes em `src/components/ui/` são primitivos shadcn (button, card, table, dialog, etc.). O App usa apenas `<Toaster />` do pacote `sonner`; `ui/toaster.tsx` e `use-toast` existem mas não são usados no fluxo atual.

---

## 2. Problemas de UX

- **Excesso de "Em breve"** — Muitas ações visíveis disparam apenas toast "Em breve": Novo Cliente, Importar Contatos, Desativar (ClientsPage); Editar cliente, Exportar dados, Adicionar participante, Conectar canal, Upload documentos, Reimportar/Desconectar canal, Editar SLA, +adicionar tema, Nova regra, Editar/Remover participante (ClientDetailPage); importação de transcrições (SettingsPage). Transmite produto inacabado.
- **Auditorias vazias** — Página é placeholder; o Dashboard ainda direciona para ela em "Próximos passos", gerando expectativa sem entrega.
- **Dashboard pouco "CX"** — KPIs são só do Gist (contatos, conversas, tags, etc.). Não há indicadores de **classificação** (tom, temas, tendências) nem ações rápidas por cliente/risco. Para Fase 5, o dashboard não reflete ainda o valor dos dados já classificados.
- **"Saúde" ambígua** — Na tabela de clientes, a coluna "Saúde" usa barra em que **mais % = mais vermelho**. Para a maioria dos usuários, "saúde" alta = verde. Ou se inverte a escala (alta = bom) ou se renomeia (ex.: "Risco" / "Nível de atenção").
- **Marca inconsistente** — Login/Signup mostram "Hub Central"; sidebar e contexto falam em uMode / CX Hub. Falta alinhar nome e identidade.
- **404 em inglês** — NotFound está em inglês ("Page not found", "Return to Home") enquanto o resto da app é PT-BR.
- **Tasks bloqueadas** — Aba "Tasks" na ficha do cliente está desabilitada com tooltip "em breve". Gera ruído se a funcionalidade não estiver no roadmap próximo.

---

## 3. Problemas técnicos (Checklist CTO m1–m13)

| Item | Regra | Encontrado |
|------|--------|------------|
| **m1** | Zero `any` fora de UI | **Violações:** `InteractionsFeed.tsx`: `raw_payload: any`, `attachments: any`, `parseAttachments(raw: any)`, `(a: any)`, `(t as any)`; `ClientContext.tsx`: `['pending','running'] as any`, `(j: any)`, `(j.progress as any)`, `status: 'cancelled' as any`; `SettingsPage.tsx`: `(supabase as any)`, `(supabase.rpc as any)`, `status: 'pending' as any` em update de job. |
| **m2** | Error boundaries em toda rota | **OK** nas rotas protegidas. **Falta:** rota `*` (NotFound) e rotas públicas `/login`, `/signup` não envolvidas em ErrorBoundary. |
| **m3** | Toast único (sonner); sem use-toast/Toaster duplicado | **Parcial:** Só o `<Toaster />` do sonner está no App. Existem `ui/toaster.tsx` e `ui/use-toast.ts` (e hook `use-toast`) não usados — risco de alguém adicionar segundo sistema de toasts. |
| **m4** | staleTime > 0 (5 min estáveis, 30 s dinâmicos) | **Violações:** Em `ClientDetailPage.tsx` as queries `client_detail`, `detail_participants`, `detail_bindings`, `detail_interactions_30d`, `detail_audit_rules`, `detail_total_interactions` **não têm `staleTime`**. Demais páginas/hooks (ClientsPage, SettingsPage, useGistKPIs, InteractionsFeed) estão com staleTime. |
| **m5** | queryKey completo; invalidação alinhada | **Violação:** Em `ClientDetailPage.tsx`, `invalidateQueries` usa `["client_detail", slug]` e `["detail_audit_rules", clientId]` enquanto as queryKeys incluem `user?.id`. Invalidação pode não bater com a chave real. |
| **m6** | useRef em vez de DOM IDs estáticos | **Violação:** `LoginPage.tsx` e `SignupPage.tsx` usam `id="email"`, `id="password"`, `id="confirmPassword"` em inputs. Checklist pede uso de ref quando o ID for usado para foco/associação programática. |
| **m7** | Guard contra chamadas duplas | Não verificado em detalhe (paste/blur, submit duplo). |
| **m8** | Erros Supabase tratados ({ data, error }) | Tratamento presente nas páginas e no wizard (destructuring + throw ou toast). |
| **m9** | useMutation para escrita (não useState manual) | **Violações:** `ClientDetailPage.tsx`: `handleSaveScope`, `handleDeactivate`, `handleToggleRule` usam `setSavingScope` / `setDeactivating` e chamadas diretas ao Supabase sem `useMutation`. SettingsPage usa `useMutation` no AutoSyncCard, mas `handleRetryJob`, `handleApplyInactivationRule` e outros são manuais. |
| **m10** | refetch() não descartado | Nenhum uso explícito de `refetch()` encontrado nas páginas lidas; invalidações feitas com `queryClient.invalidateQueries`. |
| **m11** | Zero imports não usados | Não auditado arquivo a arquivo. |
| **m12** | Paginação em listas > 50 | **Violação:** Listas usam `.limit(100)` ou `.limit(200)` sem UI de paginação (offset/cursor). Ex.: ClientsPage até 100 clientes, ClientDetailPage 200 interações e 200 participantes. Se o volume passar de 50, não há "página seguinte" nem "carregar mais". |
| **m13** | Testes em caminhos críticos | Não verificado (AGENTS cita process-jobs, classify-batch, ClientContext, listagens de interactions). |

**Outro:** Em `ClientDetailPage.tsx`, o trecho `if (scopeText === null && client) { setScopeText(meta.scope ?? ""); }` é atualização de estado durante o render; pode gerar avisos no Strict Mode. Preferir inicialização em `useState` condicionada a `client` ou `useEffect` para sincronizar com `meta.scope`.

---

## 4. Proposta de evolução para o dashboard da Fase 5 (prioridade de impacto)

1. **Dashboard orientado a CX e classificação (alto impacto)**  
   Incluir KPIs ou resumos a partir dos **dados já classificados**: distribuição de tom (ok / atenção / alerta / crítico), temas mais frequentes, tendência (ex.: últimos 7d vs 30d). Manter KPIs Gist como contexto, mas destacar o que vem da IA (tom, tema, volume por cliente). Opcional: mini gráficos de tendência (volume, tom) e atalhos para clientes com pior tom ou mais interações.

2. **Reduzir ruído de "Em breve" (alto impacto)**  
   Remover ou desabilitar botões/links que só mostram "Em breve", ou movê-los para um único bloco "Em breve" nas configurações. Manter apenas ações realmente implementadas (ex.: sync, escopo, regras de alerta, desativar cliente). Aba "Tasks": remover do menu até existir implementação ou deixar escondida por feature flag.

3. **Alinhar Auditorias com Fase 6 (médio impacto)**  
   Ou remover o link "Auditorias" do Dashboard e do sidebar até a Fase 6, ou deixar a página com texto claro "Em construção — Fase 6" e sem CTAs que pareçam ativos.

4. **Corrigir violações do Checklist (médio impacto)**  
   m1: Tipar `raw_payload`/`attachments` e retornos de RPC/status (evitar `as any`). m4: Definir `staleTime` em todas as queries de ClientDetailPage. m5: Usar nas invalidações as mesmas queryKeys completas (incluindo `user?.id` onde aplicável). m9: Trocar fluxos de escrita em ClientDetailPage (salvar escopo, desativar, toggle de regra) e ações manuais em SettingsPage para `useMutation`. m12: Introduzir paginação real (offset ou cursor) nas listas de clientes e de interações/participantes quando houver > 50 itens. Corrigir inicialização de `scopeText` em ClientDetailPage (evitar setState no render).

5. **Consistência de marca e 404 (baixo impacto)**  
   Unificar nome (CX Hub / uMode) na tela de login e no resto da app. Traduzir NotFound para PT-BR e alinhar com o tom do produto.

6. **Clarificar "Saúde" (baixo impacto)**  
   Renomear para "Risco" / "Nível de atenção" ou inverter a semântica (ex.: "Saúde = 100 − risco") e ajustar cores/legenda para que "verde = bom" e "vermelho = ruim" fiquem intuitivos.

Prioridade sugerida para deixar o dashboard da Fase 5 mais profissional: **(1)** dados classificados no dashboard, **(2)** remoção/containment de "Em breve", **(3)** ajuste de Auditorias, **(4)** correções do Checklist e **(5)** marca + 404 + "Saúde".

---

*Fim do relatório. Conteúdo self-contained para copy-paste ao Projeto CX Hub / Mega Agente.*
