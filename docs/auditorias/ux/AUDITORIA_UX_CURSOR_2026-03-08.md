# Auditoria UX/UI — 2026-03-08

> Pós-Fase 5 (Priority Dashboard). Avaliação de todas as páginas, fluxos, Design System, estados, responsividade, dark mode, animações, hierarquia, micro-interações, acessibilidade e funcionalidades ausentes.  
> **Não implementar nada ainda** — plano para revisão do Claude Code e aprovação do Operador.

---

## 1. Escopo da auditoria

- **Páginas:** Index (Dashboard), ClientsPage, ClientDetailPage, SettingsPage, Audits, LoginPage, SignupPage, NotFound.
- **Referências:** CONTEXT.md (v12), docs/DESIGN_SYSTEM.md, .cursor/rules.

---

## 2. Problemas encontrados

| # | Página | Problema | Severidade | Proposta |
|---|--------|----------|------------|----------|
| 1 | ClientsPage, ClientDetailPage | **TONE_CONFIG** usa apenas cores light (`bg-green-100 text-green-700`, etc.). Design System 1.1 exige pares light/dark (ex.: `dark:bg-emerald-950 dark:text-emerald-400`). | Média | Unificar tom em um único objeto (ex.: `TONE_CONFIG`) com classes que incluam variantes `dark:` conforme DS 1.1. |
| 2 | SettingsPage | **jobStatusBadge** usa cores fixas sem dark (ex.: `bg-yellow-50 text-yellow-700 border-yellow-200`). | Média | Adicionar variantes `dark:bg-* dark:text-* dark:border-*` ou usar tokens semânticos do tema. |
| 3 | ClientsPage | **Estado de erro** da query de clientes não tratado. Em falha, `data` é undefined e a tela mostra "Nenhum cliente ativo", confundindo erro com vazio. | Alta | Tratar `isError` da useQuery: exibir Alert com mensagem de erro e botão "Tentar novamente" (refetch), em linha com Index e Design System 3.2. |
| 4 | ClientDetailPage | **Estado de erro** da query do cliente não diferenciado. `!client` cobre tanto 404 quanto falha de rede; não há retry. | Média | Se a query tiver `isError`, exibir Alert destrutivo + "Tentar novamente". Manter "Cliente não encontrado" apenas quando `!client && !isError`. |
| 5 | SettingsPage | Múltiplas queries (gist_bindings, clients, sync_jobs, etc.) **sem estado de loading/erro unificado** por aba. Usuário pode ver conteúdo parcial ou vazio sem feedback. | Média | Por aba (Integrações, Sincronização, etc.): loading com Skeleton ou spinner; erro com Alert + retry quando aplicável. |
| 6 | Audits | **Página placeholder**: botões "Nova Auditoria" e "Criar primeira auditoria" não fazem nada. Texto promete alertas por WhatsApp/Email/Slack. | Alta | Fase 6: implementar fluxo real ou, até lá, deixar empty state explícito ("Em desenvolvimento — Fase 6") e desabilitar/ocultar CTAs que não funcionam. |
| 7 | NotFound | **Navegação**: usa `<a href="/">` em vez de React Router (`<Link to="/">`), causando full reload. | Baixa | Trocar para `<Link to="/">` e manter estilos atuais. |
| 8 | DashboardLayout | **Padding do main** é fixo `p-6`. Design System 5: "p-6 (desktop), p-4 (mobile)". | Baixa | Alterar para `p-4 md:p-6` no `<main>`. Páginas que já aplicam seu próprio padding (ex.: Index) continuam consistentes. |
| 9 | ClientsPage | **Loading da tabela**: apenas Skeleton genérico; não usa `animate-shimmer` como no Dashboard. | Baixa | Aplicar `animate-shimmer` aos Skeletons da tabela para alinhar ao DS 2.1. |
| 10 | ClientDetailPage | **Loading**: Skeleton sem animação. | Baixa | Usar `animate-shimmer` nos Skeletons de loading do detalhe. |
| 11 | Várias | **Acessibilidade**: poucos `aria-label`, `role` ou `focus-visible` explícitos em botões de ícone, tabelas clicáveis e Collapsible. Contraste em geral ok (tokens do tema). | Média | Revisar botões de ícone (DropdownMenu trigger, Collapsible trigger, "Ver detalhes"): adicionar `aria-label` onde o texto não estiver visível; garantir `focus-visible:ring-2` em controles interativos; linha da tabela clicável considerar `role="button"` + `tabIndex={0}` + tecla Enter. |
| 12 | ClientsPage | **Ordenação**: SortButton não recebe foco visível destacado nem indicação de acessibilidade (aria-sort). | Baixa | Adicionar `aria-sort` no header da coluna ordenada; manter ou reforçar estilo de foco. |
| 13 | Index (Dashboard) | **Sem filtro/busca**: lista só exibe até 50 e não há filtro por nome/tier. | Média | Melhoria proposta abaixo (filtros/busca no Dashboard). |
| 14 | Login / Signup | **Loading de submit**: usa `useState(submitting)` em vez de `useMutation` (m9). Não é bug de UX, mas desvio do checklist. | Baixa | Opcional: migrar submit para useMutation para alinhar a m9; UX atual já mostra loading no botão. |
| 15 | ClientDetailPage | **Tabs** muito numerosas (Visão Geral, Interações, Participantes, Canais, Documentos, Regras, Configurações, Tasks). Em mobile pode ficar apertado. | Média | Considerar agrupamento (ex.: "Dados" com sub-abas) ou scroll horizontal explícito com indicador; manter hierarquia clara. |

---

## 3. Fluxos de navegação

- **Dashboard → Clientes → Detalhe**: coerente; breadcrumb implícito (voltar para Clientes). Falta link "Dashboard" no detalhe para voltar ao ranking.
- **Sidebar**: Dashboard, Clientes, Auditorias, Configurações. Auditorias leva a placeholder — usuário pode achar que há funcionalidade.
- **Login / Signup**: fluxo claro; após login redireciona para `/`. Sem link "Esqueci a senha" (não solicitado na auditoria).
- **Pontos mortos**: Auditorias (CTA sem ação); nenhum atalho do Dashboard para um cliente específico além de clicar no nome (ok).

**Proposta de ajuste de fluxo:** No ClientDetailPage, além de "Voltar para Clientes", oferecer link "Ver no Dashboard" (anchor para o ranking de prioridade) quando o cliente tiver score.

---

## 4. Consistência visual

- **Cores:** Desvios nos itens 1 e 2 (tom e status de job sem dark). Demais páginas usam tokens (primary, muted, border) ou paleta do DS (tier, score, severity).
- **Espaçamento:** Em geral gap-4 / gap-6 e cards consistentes; exceção no layout main (item 8).
- **Tipografia:** Títulos `text-2xl font-bold`, descrições `text-muted-foreground` em linha com DS 4.
- **Badges:** Tier e severity no Dashboard seguem DS 1.2 e 1.4; ClientsPage/ClientDetailPage usam tom com classes que faltam dark.

---

## 5. Estados vazios, loading e erro

| Página | Vazio | Loading | Erro |
|--------|--------|---------|------|
| Index | Sim (Nenhum score calculado ainda) | Sim (Skeleton + shimmer) | Sim (Alert + Tentar novamente) |
| ClientsPage | Sim (Nenhum cliente ativo) | Sim (Skeleton) | **Não** (item 3) |
| ClientDetailPage | N/A (detalhe de entidade) | Sim (Skeleton) | Parcial (not found sim; erro de query não diferenciado — item 4) |
| SettingsPage | Vários por aba | Parcial (alguns controles disabled) | Parcial (sem Alert global por aba — item 5) |
| Audits | Sim (Nenhuma auditoria configurada) | N/A | N/A (placeholder) |
| Login/Signup | N/A | Sim (botão loading) | Toast | 
| NotFound | N/A | N/A | N/A |

---

## 6. Responsividade

- **Index:** Layout flex/stack, cards em coluna; botões e texto quebram em mobile. Paginação e aviso "Exibindo os 50 primeiros" visíveis.
- **ClientsPage:** Tabela com scroll horizontal em telas pequenas; busca e header empilham. Paginação abaixo da tabela.
- **ClientDetailPage:** Muitas abas (item 15); grids (ex.: KPI) já em `grid-cols-2 lg:grid-cols-3`. Em mobile pode faltar padding consistente se depender só do layout.
- **SettingsPage:** Tabs e cards empilham; formulários longos. Aceitável.
- **Login/Signup:** Card centralizado, max-w-sm; ok em mobile.
- **NotFound:** Centralizado; ok.

**Quebras potenciais:** Tabela de clientes com muitas colunas em 320px; aba de detalhe com muitas tabs. Recomendação: garantir overflow horizontal na tabela e considerar agrupamento de tabs em breakpoint pequeno.

---

## 7. Dark mode

- **Problemas:** Itens 1 e 2 (tom e status de job sem variante dark). Demais telas usam `bg-card`, `text-foreground`, `border-border`, `muted`, etc., que seguem o tema.
- **Sidebar e header:** Componentes shadcn (Sidebar, Button) herdam tema; logo e ícones sem cor fixa problemática.

---

## 8. Animações

- **Dashboard (Index):** fade-in-up (stagger), score-pop, progress-fill, pulse-subtle (score ≥ 80), shimmer (loading). Alinhado ao DS 2.1.
- **Demais páginas:** Quase nenhuma das 5 animações custom. ClientsPage e ClientDetailPage: só hover em linhas e botões (transition).
- **Transições de página:** Não há transição entre rotas (React Router troca direto). Opcional: animação sutil de entrada (ex.: fade-in) por rota.
- **Oportunidades:** Loading em ClientsPage e ClientDetailPage com `animate-shimmer`; possível `animate-fade-in-up` na primeira aparição da lista de clientes ou cards do detalhe.

---

## 9. Hierarquia de informação

- **Admin vs viewer:** No Dashboard, admin vê "Atualizar agora" e contagem de clientes sem config; viewer não vê. Restante das páginas não diferencia role (ClientDetailPage, SettingsPage, ClientsPage acessíveis a todos os logados). Se houver ações restritas a admin em outras telas no futuro, manter padrão: ocultar ação, não desabilitar.
- **Dashboard:** Score em destaque (número + barra); tier e nome visíveis; patterns em expansão. Coerente com "score como hierarquia principal".
- **ClientDetailPage:** KPIs no topo; abas separam interações, participantes, canais, etc. Tab "Tasks" desabilitada com aviso — decisão de produto mantida.

---

## 10. Micro-interações

- **Hover:** TableRow em ClientsPage e ClientDetailPage com `hover:bg-muted/30`; cards no Dashboard com `hover:shadow-md`. Botões e links com hover dos componentes shadcn.
- **Active/feedback:** Botões com estado loading (Loader2 + animate-spin). Falta feedback tátil (ex.: `active:scale-95`) em alguns botões custom (ex.: SortButton).
- **Collapsible (Dashboard):** Ícone troca entre ChevronDown/Up; conteúdo expande/colapsa. Sem animação de altura (Radix pode animar via CSS).

**Sugestão:** Aplicar `active:scale-95 transition-transform` em botões primários e secundários onde ainda não existir (DS 2.3).

---

## 11. Funcionalidades ausentes (melhorias propostas)

| # | Funcionalidade | Onde | Impacto | Esforço |
|---|----------------|------|---------|---------|
| 1 | **Settings → Prioridades (gestão tier/peso)** | Nova aba ou seção em SettingsPage | Admin consegue configurar/editar tier e weight_multiplier por cliente (client_priority_config) sem depender só de seed/migrations. | Alto (tela de listagem + edição; possivelmente modal ou rota; sem mudar backend já existente). |
| 2 | **Filtros/busca no Dashboard** | Index.tsx | Filtrar por nome do cliente ou tier; reduz ruído quando há muitos clientes. | Médio (estado de filtro; filtrar `displayList` ou query com params). |
| 3 | **Gráficos no Dashboard (Recharts)** | Index.tsx | Distribuição de score (faixas 0–29, 30–59, 60–79, 80–100); distribuição por tier; top temas dos patterns. Aproveita ChartContainer (tema). | Médio (dados já em usePriorityScores; agregar e montar 1–3 gráficos). |
| 4 | **Link "Ver no Dashboard" no ClientDetailPage** | ClientDetailPage (header ou breadcrumb) | Navegação rápida do detalhe para o ranking de prioridade. | Baixo (Link para `/` ou `/#` com estado opcional). |
| 5 | **Breadcrumb explícito (Dashboard > Clientes > Nome)** | ClientDetailPage e/ou layout | Melhora orientação e navegação. | Baixo (componente Breadcrumb shadcn ou inline). |
| 6 | **Auditorias: empty state honesto** | Audits.tsx | Evitar expectativa de funcionalidade inexistente; alinhar à Fase 6. | Baixo (texto "Em desenvolvimento" e desabilitar/ocultar CTAs). |

---

## 12. Priorização sugerida

1. **Alta (corrigir antes de novas features)**  
   - Item 3: Estado de erro em ClientsPage.  
   - Item 6: Audits — empty state honesto ou preparação para Fase 6 (evitar CTAs que não funcionam).

2. **Média (consistência e acessibilidade)**  
   - Itens 1 e 2: Dark mode em TONE_CONFIG e jobStatusBadge.  
   - Item 4: Estado de erro + retry em ClientDetailPage.  
   - Item 5: Loading/erro por aba em SettingsPage.  
   - Item 11: Acessibilidade (aria-label, focus-visible, teclado em tabela/Collapsible).

3. **Baixa (polimento)**  
   - Itens 7, 8, 9, 10: NotFound Link, padding do layout, shimmer nos loadings, SortButton aria-sort.  
   - Itens 14 e 15: useMutation em Login/Signup (opcional); revisão de tabs em mobile.

4. **Novas funcionalidades (após aprovação)**  
   - Item 1 da tabela de melhorias: Settings → Prioridades (admin).  
   - Item 2: Filtros/busca no Dashboard.  
   - Item 3: Gráficos no Dashboard.  
   - Itens 4 e 5: Link "Ver no Dashboard" e breadcrumb.

---

## 13. Mockups / wireframes (opcional)

### 13.1 Settings → Prioridades (admin only)

- **Onde:** Nova aba "Prioridades" em SettingsPage (ou seção dentro de uma aba existente), visível só se `useUserRole().isAdmin`.
- **Conteúdo:** Tabela ou lista de clientes com colunas: Nome, Tier (select: azzas | enterprise | medium | small), Peso (weight_multiplier, número), Última atualização. Ações: "Editar" abre modal ou inline para alterar tier e peso; persistir em `client_priority_config` (update ou insert). Sem alterar backend: usar Supabase client com RLS.
- **Fluxo:** Admin abre Configurações → Prioridades → vê lista → edita → salva → toast sucesso; opcional invalidate de priority-scores para refletir no Dashboard.

### 13.2 Dashboard com filtros e gráficos

- **Filtros:** Acima da lista de cards, uma linha com: Input de busca (por nome do cliente) e Select ou botões de filtro por Tier (Todos, azzas, enterprise, medium, small). Lista e contagem atualizam em tempo real (filter no front ou queryKey com filtros).
- **Gráficos:** Acima da lista ranqueada, 1–2 cards em grid:
  - **Card 1:** Gráfico de barras (ChartContainer + BarChart) — eixo X: faixas de score (0–29, 30–59, 60–79, 80–100), eixo Y: quantidade de clientes.
  - **Card 2:** Gráfico de donut ou barras — distribuição por tier (quantidade por azzas, enterprise, medium, small).
- Layout: [ Filtros ] [ Gráficos 2 colunas ] [ Lista ranqueada (como hoje) ].

### 13.3 ClientDetailPage — breadcrumb e link Dashboard

- Abaixo do header (nome do cliente e meta), linha: `Dashboard > Clientes > {client.name}` (links clicáveis). À direita, botão ou link discreto: "Ver no Dashboard" → navega para `/` (ou scroll para o card do cliente se no futuro houver âncora).

---

## 14. Resumo

- **Problemas críticos:** Estado de erro em ClientsPage; Auditorias como placeholder com CTAs inativos.
- **Consistência:** Ajustar tom (TONE_CONFIG) e status de job (Settings) ao Design System com dark mode; alinhar loading (shimmer) e padding do layout.
- **Acessibilidade:** Reforçar aria-labels, focus visível e teclado em tabelas e controles de ícone.
- **Funcionalidades sugeridas:** Prioridades em Settings (admin), filtros/busca no Dashboard, gráficos (Recharts), breadcrumb e link para o Dashboard no detalhe do cliente.

Nenhuma alteração de backend, banco ou edge functions foi proposta. Nenhuma lib nova obrigatória (Recharts já existe). Evolução incremental, sem redesign completo.
