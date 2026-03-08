# Plano de Testes E2E — CX Hub uMode

> Data: 2026-03-08 | Versao: v1
> Objetivo: verificar que TUDO funciona ponta a ponta, sem nada hardcoded.

---

## Pre-requisitos

- Usuario admin com pelo menos 1 cliente associado e interacoes classificadas
- Usuario viewer (role != admin) para testes de permissao
- Dados reais no Supabase (nao mocks)

---

## 1. Autenticacao

| # | Teste | Esperado |
|---|-------|----------|
| 1.1 | Acessar `/` sem login | Redireciona para `/login` |
| 1.2 | Login com credenciais validas | Redireciona para `/` (Dashboard) |
| 1.3 | Login com credenciais invalidas | Toast de erro (sonner) |
| 1.4 | Signup com email novo | Conta criada, redirecionado |
| 1.5 | Logout | Redireciona para `/login` |
| 1.6 | Acessar rota protegida apos logout | Redireciona para `/login` |

---

## 2. Dashboard (`/`)

| # | Teste | Esperado |
|---|-------|----------|
| 2.1 | Carregamento inicial | Skeletons shimmer visiveis, depois dados reais |
| 2.2 | KPI cards (4) | Total interacoes 30d, % critico, % alerta, clientes monitorados — valores numericos reais |
| 2.3 | Grafico evolucao de tom mensal | BarChart empilhado com cores do Design System (emerald/yellow/orange/red) |
| 2.4 | Grafico top temas | HorizontalBarChart com ate 5 temas |
| 2.5 | Score de prioridade | Cards com scores calculados, badges por tier (S/A/B/C) |
| 2.6 | Botao recalcular prioridade (admin) | Dispara `calculate-priority-scores`, toast de sucesso, dados atualizam |
| 2.7 | Botao recalcular (viewer) | NAO deve aparecer |
| 2.8 | Dark mode | Todos os cards, graficos e badges com cores corretas |
| 2.9 | RPC chamada | `global_stats_30d(p_user_id)` — verificar no Network tab que p_user_id = user logado |
| 2.10 | Erro de rede | Error boundary ou toast, nao tela branca |

---

## 3. Clientes (`/clients`)

| # | Teste | Esperado |
|---|-------|----------|
| 3.1 | Lista de clientes | Mostra apenas clientes do usuario (via `user_accessible_client_ids`) |
| 3.2 | Busca por nome | Filtra lista em tempo real |
| 3.3 | Click em cliente | Navega para `/clients/:slug` |
| 3.4 | Loading state | Skeletons visiveis |
| 3.5 | Empty state (usuario sem clientes) | Mensagem informativa, nao erro |
| 3.6 | Dark mode | Cores corretas em cards/badges |

---

## 4. Detalhe do Cliente (`/clients/:slug`)

| # | Teste | Esperado |
|---|-------|----------|
| 4.1 | Dados do cliente | Nome, metricas, interacoes recentes |
| 4.2 | Grafico volume 14d | BarChart com dados reais dos ultimos 14 dias |
| 4.3 | Grafico tendencia tom 7d | BarChart empilhado (ok/atencao/alerta/critico), cores Design System |
| 4.4 | Tendencia tom — loading | Skeleton h-48 com shimmer |
| 4.5 | Tendencia tom — empty | "Sem interacoes classificadas nos ultimos 7 dias" |
| 4.6 | Barra compacta de tom | Preservada (% total), complementar ao grafico 7d |
| 4.7 | RPC chamada | `client_tone_trend_7d(p_user_id, p_client_id)` — ambos UUID reais |
| 4.8 | XAxis formatado | Datas no formato DD/MM (ex: "08/03") |
| 4.9 | Slug invalido | 404 ou mensagem "Cliente nao encontrado" |
| 4.10 | Dark mode | Graficos, badges, cards |

---

## 5. Busca (`/search`)

| # | Teste | Esperado |
|---|-------|----------|
| 5.1 | Estado inicial | "Digite ao menos 3 caracteres para buscar" |
| 5.2 | Digitar 1-2 chars | Nenhuma busca disparada |
| 5.3 | Digitar 3+ chars | Busca com debounce 300ms, resultados aparecem |
| 5.4 | Filtro por cliente | Select com lista de clientes do usuario, filtra resultados |
| 5.5 | Filtro por tom | Select (Todos/Ok/Atencao/Alerta/Critico), filtra resultados |
| 5.6 | Tabela de resultados | Colunas: Cliente, Remetente (com badge customer/agent), Corpo (truncado 100 chars), Tom (badge colorido), Tema, Data (tempo relativo ptBR) |
| 5.7 | Paginacao | Botoes Anterior/Proximo, "X de Y resultados", PAGE_SIZE=20 |
| 5.8 | Resultado vazio | "Nenhum resultado encontrado para [query]" |
| 5.9 | Erro de rede | Alert com botao refetch |
| 5.10 | Loading | Skeletons shimmer |
| 5.11 | RPC chamada | `search_interactions(p_user_id, p_query, p_client_id, p_tone, p_limit, p_offset)` — verificar parametros reais |
| 5.12 | Dark mode | Badges, tabela, filtros |

---

## 6. Auditorias (`/audits`)

| # | Teste | Esperado |
|---|-------|----------|
| 6.1 | KPI cards | Total alertas 30d, alertas nao lidos — valores numericos reais |
| 6.2 | Tabela de alertas | Colunas com cliente, metrica (traduzida pt-BR), severidade (badge), data |
| 6.3 | Traducao de metricas | `pct_critical` → "% Crítico", `tone_drop_7d` → "Queda de tom 7d", etc. |
| 6.4 | Badges de severidade | warning = amarelo, critical = vermelho, info = azul (com dark mode) |
| 6.5 | Loading | Skeletons shimmer |
| 6.6 | Empty state | Mensagem quando nao ha alertas |
| 6.7 | Erro de rede | Mensagem com botao refetch |
| 6.8 | RPC chamada | `audit_alerts_summary(p_user_id)` — UUID real |
| 6.9 | Dark mode | Cards, tabela, badges |

---

## 7. Configuracoes (`/settings`)

| # | Teste | Esperado |
|---|-------|----------|
| 7.1 | Pagina carrega | Configuracoes do usuario visiveis |
| 7.2 | Dark mode toggle | Tema alterna corretamente em toda a app |

---

## 8. Sidebar / Navegacao

| # | Teste | Esperado |
|---|-------|----------|
| 8.1 | 5 itens visiveis | Dashboard, Clientes, Busca, Auditorias, Configuracoes |
| 8.2 | Ordem correta | Na ordem listada acima |
| 8.3 | Icones | BarChart3, Users, Search, ShieldAlert, Settings |
| 8.4 | Item ativo destacado | Cor diferente no item da pagina atual |
| 8.5 | Navegacao funcional | Click em cada item leva a rota correta |
| 8.6 | Mobile | Sidebar colapsa, hamburger menu funcional |

---

## 9. Permissoes (Admin vs Viewer)

| # | Teste | Esperado |
|---|-------|----------|
| 9.1 | Admin ve botao recalcular | Visivel no Dashboard |
| 9.2 | Viewer NAO ve botao recalcular | Oculto no Dashboard |
| 9.3 | Ambos veem Dashboard | KPIs e graficos visiveis para ambos |
| 9.4 | Isolamento de dados | Cada usuario ve apenas seus clientes |
| 9.5 | RLS enforcement | Queries retornam apenas dados permitidos pelo RLS |

---

## 10. Verificacao Anti-Hardcode

| # | Teste | Esperado |
|---|-------|----------|
| 10.1 | Nenhum UUID hardcoded em pages/ | Todos vem de `useAuth()` ou parametros de rota |
| 10.2 | Nenhum localhost/URL hardcoded | Supabase client usa env vars |
| 10.3 | API keys nao expostas no bundle | Verificar source map / Network tab |
| 10.4 | Cores via Design System | Nenhuma cor hex hardcoded fora do TONE_CONFIG |
| 10.5 | staleTime configurado | Nenhum hook com staleTime=0 ou ausente |
| 10.6 | queryKey completo | Todos os hooks incluem user?.id + parametros relevantes |

---

## 11. Dark Mode (transversal)

| # | Teste | Esperado |
|---|-------|----------|
| 11.1 | Toggle dark/light | Todas as paginas alternam sem flash |
| 11.2 | Graficos recharts | Cores legiveis em ambos os modos |
| 11.3 | Badges de tom | Pares de cores dark mode (bg-*-950 / text-*-400) |
| 11.4 | Tabelas | Bordas e backgrounds adaptam |
| 11.5 | Skeletons | Shimmer visivel em ambos os modos |

---

## 12. Error Boundaries

| # | Teste | Esperado |
|---|-------|----------|
| 12.1 | Simular erro em cada rota | Error boundary captura, nao tela branca |
| 12.2 | RPC falha (Supabase down) | Toast ou mensagem de erro, botao retry |
| 12.3 | Rede offline | Comportamento gracioso, dados em cache se disponivel |

---

## Como Executar

### Manual (recomendado agora)
1. Abrir app em modo light e dark
2. Seguir cada secao sequencialmente
3. Marcar ✅ ou ❌ em cada teste
4. Reportar falhas com screenshot

### Automatizado (futuro)
- Cypress ou Playwright quando volume justificar
- Priorizar rotas criticas: Dashboard, Busca, Auditorias
- CI/CD com Supabase local (containers)

---

## Resultado

- Total de testes: 67
- Cobertura: 8 rotas, 8 hooks, 5 RPCs, 2 perfis, dark mode, anti-hardcode
- Criterio de aprovacao: 100% pass (zero ❌)
