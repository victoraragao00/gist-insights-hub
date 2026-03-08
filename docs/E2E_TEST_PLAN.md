# Checklist de Testes E2E — CX Hub uMode

> **Versao:** v2 | **Data:** 2026-03-08
> **Ultima atualizacao:** 2026-03-08
> **Total de testes:** 67
> **Criterio de aprovacao:** 100% pass (zero falhas)

---

## Sobre este documento

Este e o checklist oficial de testes end-to-end do CX Hub uMode. Ele cobre todas as paginas, funcionalidades, permissoes e comportamentos visuais da aplicacao.

**Quem executa:** qualquer pessoa da equipe, sem necessidade de conhecimento tecnico profundo. Basta seguir os passos.

**Quando executar:**
- Antes de cada release para producao
- Apos merge de PRs que alteram paginas, hooks ou rotas
- Apos entregas do Lovable (migrations, edge functions) que impactam dados exibidos

**Regra de ouro:** toda feature nova adicionada ao app DEVE ter testes correspondentes adicionados a este checklist antes de ser considerada "pronta".

---

## Como usar este checklist

### Preparacao

1. Abra a aplicacao no navegador (URL fornecida pelo Operador)
2. Tenha acesso a **duas contas**:
   - **Conta Admin** — usuario com role `admin` na tabela `user_client_access`, com pelo menos 1 cliente associado e interacoes classificadas
   - **Conta Viewer** — usuario com role diferente de `admin` (ex: `viewer`), para testar permissoes
3. Abra o DevTools do navegador (F12) na aba **Network** para verificar chamadas RPC quando indicado

### Execucao

- Execute os testes **na ordem apresentada** (secoes 1 a 12)
- Para cada teste, marque o resultado:
  - `[PASS]` — funcionou como esperado
  - `[FAIL]` — nao funcionou. Anote: o que aconteceu, o que era esperado, e tire screenshot
  - `[SKIP]` — nao foi possivel testar (justificar)
- Teste SEMPRE em **dois modos**: light mode e dark mode (secao 11 cobre dark mode especifico, mas cada secao tem um teste de dark mode proprio)

### Reportando falhas

Para cada `[FAIL]`, registre:

```
Teste: [numero e nome]
Resultado: [o que aconteceu]
Esperado: [o que deveria ter acontecido]
Screenshot: [anexar se visual]
Navegador: [Chrome/Safari/Firefox + versao]
Modo: [light/dark]
```

---

## Glossario para o testador

| Termo | O que e |
|-------|---------|
| **Toast** | Notificacao temporaria que aparece no canto da tela e desaparece sozinha |
| **Skeleton/Shimmer** | Retangulos cinza pulsantes que aparecem enquanto os dados carregam |
| **Badge** | Etiqueta colorida pequena (ex: "Critico" em vermelho, "Ok" em verde) |
| **RPC** | Chamada ao banco de dados. Visivel na aba Network do DevTools como POST para `/rest/v1/rpc/nome_da_funcao` |
| **Dark mode** | Tema escuro. Alternado pelo botao na interface |
| **Sidebar** | Menu lateral esquerdo com os links de navegacao |
| **Empty state** | Tela que aparece quando nao ha dados para exibir |
| **Error boundary** | Tela de erro amigavel que aparece quando algo quebra, em vez de tela branca |
| **Debounce** | Pequeno atraso intencional antes de disparar a busca (evita buscar a cada tecla) |
| **Paginacao** | Botoes "Anterior/Proximo" para navegar entre paginas de resultados |
| **Admin** | Usuario com permissao total (ve botoes extras como "Recalcular") |
| **Viewer** | Usuario com permissao limitada (so visualiza, sem acoes administrativas) |

---

## Cores de referencia (Design System)

O testador deve verificar se as cores correspondem ao contexto:

| Contexto | Cor esperada | Quando aparece |
|----------|-------------|----------------|
| Tom "Ok" | Verde (emerald) | Interacoes saudaveis |
| Tom "Atencao" | Amarelo | Requer atencao |
| Tom "Alerta" | Laranja | Acao necessaria |
| Tom "Critico" | Vermelho | Acao urgente |
| Tier "Azzas" | Roxo (brand) | Cliente tier mais alto |
| Tier "Enterprise" | Azul | Cliente grande |
| Tier "Medium" | Cinza azulado | Cliente medio |
| Tier "Small" | Cinza | Cliente pequeno |
| Score 0-29 | Verde | Baixa prioridade |
| Score 30-59 | Amarelo | Media prioridade |
| Score 60-79 | Laranja | Alta prioridade |
| Score 80-100 | Vermelho | Critica |

---

## 1. Autenticacao

> **Contexto:** a aplicacao usa Supabase Auth. Todas as paginas exceto `/login` e `/signup` sao protegidas — o usuario deve ser redirecionado se nao estiver logado.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 1.1 | Acesso sem login | Abrir a URL da app diretamente (ex: `/`) sem estar logado | Redireciona automaticamente para `/login` | [ ] |
| 1.2 | Login valido | Na tela de login, inserir email e senha validos e clicar "Entrar" | Redireciona para o Dashboard (`/`). Dados do usuario aparecem | [ ] |
| 1.3 | Login invalido | Inserir email ou senha incorretos e clicar "Entrar" | Toast de erro aparece. Nao redireciona | [ ] |
| 1.4 | Signup | Clicar em "Criar conta", preencher email novo e senha | Conta criada. Redireciona para o app | [ ] |
| 1.5 | Logout | Clicar no botao de logout (no canto ou menu do usuario) | Redireciona para `/login`. Sessao encerrada | [ ] |
| 1.6 | Rota protegida apos logout | Apos fazer logout, digitar na barra de endereco `/clients` | Redireciona para `/login` | [ ] |

---

## 2. Dashboard (`/`)

> **Contexto:** pagina principal. Exibe KPIs globais dos ultimos 30 dias, graficos de tendencia e scores de prioridade dos clientes. Dados vem da funcao `global_stats_30d`.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 2.1 | Loading state | Acessar `/` e observar os primeiros 1-2 segundos | Retangulos cinza pulsantes (skeletons) aparecem no lugar dos dados. Depois sao substituidos por dados reais | [ ] |
| 2.2 | KPI cards | Verificar os 4 cards no topo da pagina | Mostram: (1) Total interacoes 30d, (2) % critico, (3) % alerta, (4) Clientes monitorados. Todos com numeros reais, nao zeros | [ ] |
| 2.3 | Grafico evolucao de tom | Verificar o grafico de barras empilhadas | Barras com 4 cores empilhadas: verde (ok), amarelo (atencao), laranja (alerta), vermelho (critico). Eixo X com meses | [ ] |
| 2.4 | Grafico top temas | Verificar o grafico de barras horizontais | Ate 5 temas listados com barras proporcionais. Labels legiveis | [ ] |
| 2.5 | Scores de prioridade | Verificar cards/lista de clientes com scores | Cada cliente tem um numero de score e um badge de tier (S/A/B/C). Barra de progresso preenchida proporcionalmente | [ ] |
| 2.6 | Botao recalcular (admin) | Logado como admin, procurar botao "Recalcular" ou similar | Botao visivel. Ao clicar: loading momentaneo, toast de sucesso, scores atualizam | [ ] |
| 2.7 | Botao recalcular (viewer) | Logado como viewer, verificar se o botao existe | Botao NAO deve aparecer | [ ] |
| 2.8 | Dark mode | Alternar para dark mode | Cards com fundo escuro, textos legiveis, graficos com cores visiveis, badges com variantes dark corretas | [ ] |
| 2.9 | Verificar RPC (tecnico) | No DevTools > Network, observar chamadas ao carregar | Deve haver POST para `global_stats_30d` com `p_user_id` = UUID do usuario logado (nao hardcoded) | [ ] |
| 2.10 | Erro de rede | Desconectar internet e recarregar a pagina | Mensagem de erro amigavel ou toast. NUNCA tela branca | [ ] |

---

## 3. Clientes (`/clients`)

> **Contexto:** lista todos os clientes associados ao usuario logado. Cada usuario so ve seus proprios clientes (isolamento por RLS). Clicar em um cliente leva ao detalhe.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 3.1 | Lista de clientes | Acessar `/clients` | Lista mostra apenas os clientes do usuario logado. Nao mostra clientes de outros usuarios | [ ] |
| 3.2 | Busca por nome | Digitar parte do nome de um cliente no campo de busca | Lista filtra em tempo real mostrando apenas clientes que correspondem | [ ] |
| 3.3 | Navegacao ao detalhe | Clicar no card/linha de um cliente | Navega para `/clients/:slug` com os dados do cliente selecionado | [ ] |
| 3.4 | Loading state | Recarregar a pagina e observar | Skeletons aparecem enquanto dados carregam | [ ] |
| 3.5 | Empty state | Logar com usuario sem clientes associados (se disponivel) | Mensagem amigavel tipo "Nenhum cliente encontrado", nao erro | [ ] |
| 3.6 | Dark mode | Alternar para dark mode | Cards e badges com cores corretas no tema escuro | [ ] |

---

## 4. Detalhe do Cliente (`/clients/:slug`)

> **Contexto:** pagina de detalhe de um cliente especifico. Mostra metricas, interacoes recentes, grafico de volume (14 dias) e grafico de tendencia de tom (7 dias). O grafico de tendencia usa a funcao `client_tone_trend_7d`.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 4.1 | Dados basicos | Acessar detalhe de um cliente com dados | Nome do cliente, metricas resumidas e lista de interacoes recentes visiveis | [ ] |
| 4.2 | Grafico volume 14d | Verificar grafico "Volume de interacoes ultimos 14 dias" | Barras com contagem diaria. Eixo X com datas | [ ] |
| 4.3 | Grafico tendencia tom 7d | Verificar grafico "Evolucao de tom (7 dias)" | Barras empilhadas com 4 cores: verde (ok), amarelo (atencao), laranja (alerta), vermelho (critico) | [ ] |
| 4.4 | Tendencia tom — loading | Recarregar e observar area do grafico de tom | Skeleton retangular (h-48) com animacao shimmer | [ ] |
| 4.5 | Tendencia tom — sem dados | Acessar cliente sem interacoes classificadas nos ultimos 7 dias | Mensagem "Sem interacoes classificadas nos ultimos 7 dias" | [ ] |
| 4.6 | Barra compacta de tom | Verificar se a barra horizontal de distribuicao (%) ainda existe | Deve estar presente acima ou abaixo do grafico. Mostra % total por tom | [ ] |
| 4.7 | Verificar RPC (tecnico) | No DevTools > Network | POST para `client_tone_trend_7d` com `p_user_id` e `p_client_id` como UUIDs reais | [ ] |
| 4.8 | Formato de datas | Verificar eixo X do grafico de tom | Datas no formato DD/MM (ex: "08/03"), nao formato americano | [ ] |
| 4.9 | Slug invalido | Digitar na barra de endereco `/clients/cliente-que-nao-existe` | Pagina 404 ou mensagem "Cliente nao encontrado" | [ ] |
| 4.10 | Dark mode | Alternar para dark mode | Graficos, badges e cards com cores corretas no tema escuro | [ ] |

---

## 5. Busca (`/search`)

> **Contexto:** busca global por texto em todas as interacoes do usuario. Usa full-text search via funcao `search_interactions`. Suporta filtros por cliente e tom. Paginacao real com 20 resultados por pagina. A busca so dispara apos 3 caracteres e tem um atraso intencional de 300ms (debounce).

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 5.1 | Estado inicial | Acessar `/search` sem digitar nada | Mensagem "Digite ao menos 3 caracteres para buscar" | [ ] |
| 5.2 | Menos de 3 chars | Digitar 1 ou 2 caracteres | Nenhuma busca e disparada. Mensagem inicial permanece | [ ] |
| 5.3 | Busca funcional | Digitar 3 ou mais caracteres (ex: "problema") | Apos breve atraso (~300ms), resultados aparecem na tabela | [ ] |
| 5.4 | Filtro por cliente | Selecionar um cliente no dropdown de filtro | Resultados filtrados apenas para aquele cliente | [ ] |
| 5.5 | Filtro por tom | Selecionar um tom (Ok/Atencao/Alerta/Critico) no dropdown | Resultados filtrados apenas para aquele tom | [ ] |
| 5.6 | Tabela de resultados | Verificar colunas da tabela | 6 colunas: Cliente, Remetente (com badge azul "customer" ou verde "agent"), Corpo (truncado em ~100 chars), Tom (badge colorido), Tema, Data (ex: "ha 2 dias") | [ ] |
| 5.7 | Paginacao | Buscar algo que retorne mais de 20 resultados | Botoes "Anterior/Proximo" aparecem. Texto "X de Y resultados". Clicar "Proximo" carrega proxima pagina | [ ] |
| 5.8 | Resultado vazio | Buscar algo sem resultados (ex: "xyznonexistent") | Mensagem "Nenhum resultado encontrado para [query]" | [ ] |
| 5.9 | Erro de rede | Desconectar internet e buscar | Mensagem de erro com botao para tentar novamente | [ ] |
| 5.10 | Loading | Buscar e observar durante o carregamento | Skeletons shimmer na area da tabela | [ ] |
| 5.11 | Verificar RPC (tecnico) | No DevTools > Network ao buscar | POST para `search_interactions` com p_user_id (UUID real), p_query, p_limit=20, p_offset correto | [ ] |
| 5.12 | Dark mode | Alternar para dark mode | Badges, tabela e filtros com cores corretas | [ ] |

---

## 6. Auditorias (`/audits`)

> **Contexto:** pagina de alertas automaticos gerados pelo sistema de auditoria. Mostra KPIs (total de alertas e nao lidos) e tabela de alertas com severidade. Dados vem da funcao `audit_alerts_summary`. Metricas sao traduzidas para portugues.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 6.1 | KPI cards | Verificar cards no topo | (1) Total alertas 30d e (2) Alertas nao lidos, com numeros reais | [ ] |
| 6.2 | Tabela de alertas | Verificar a tabela | Colunas: cliente, metrica (em portugues), severidade (badge colorido), data | [ ] |
| 6.3 | Traducao de metricas | Verificar coluna "metrica" | Nomes traduzidos: `pct_critical` aparece como "% Critico", `tone_drop_7d` como "Queda de tom 7d", etc. Nao deve mostrar o nome tecnico em ingles | [ ] |
| 6.4 | Badges de severidade | Verificar os badges na coluna severidade | `warning` = badge amarelo, `critical` = badge vermelho, `info` = badge azul | [ ] |
| 6.5 | Loading | Recarregar e observar | Skeletons shimmer nos cards e tabela | [ ] |
| 6.6 | Empty state | Verificar se nao houver alertas | Mensagem informativa, nao tabela vazia sem explicacao | [ ] |
| 6.7 | Erro de rede | Desconectar internet e recarregar | Mensagem de erro com botao "Tentar novamente" | [ ] |
| 6.8 | Verificar RPC (tecnico) | No DevTools > Network | POST para `audit_alerts_summary` com p_user_id = UUID real | [ ] |
| 6.9 | Dark mode | Alternar para dark mode | Cards, tabela e badges com cores escuras corretas | [ ] |

---

## 7. Configuracoes (`/settings`)

> **Contexto:** pagina de configuracoes do usuario. Permite alternar entre light/dark mode.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 7.1 | Pagina carrega | Acessar `/settings` | Pagina exibe opcoes de configuracao do usuario | [ ] |
| 7.2 | Toggle dark mode | Alternar o tema claro/escuro | Toda a aplicacao muda de tema instantaneamente, sem flash branco | [ ] |

---

## 8. Sidebar / Navegacao

> **Contexto:** menu lateral esquerdo presente em todas as paginas (exceto login/signup). Contem 5 itens de navegacao. Em telas pequenas (mobile), colapsa em menu hamburger.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 8.1 | Itens visiveis | Verificar sidebar | 5 itens: Dashboard, Clientes, Busca, Auditorias, Configuracoes | [ ] |
| 8.2 | Ordem | Verificar ordem dos itens | Exatamente na ordem: Dashboard > Clientes > Busca > Auditorias > Configuracoes | [ ] |
| 8.3 | Icones | Verificar icones ao lado de cada item | Dashboard (grafico de barras), Clientes (pessoas), Busca (lupa), Auditorias (escudo), Configuracoes (engrenagem) | [ ] |
| 8.4 | Item ativo | Navegar para cada pagina e verificar | O item correspondente a pagina atual fica destacado (cor ou fundo diferente) | [ ] |
| 8.5 | Navegacao | Clicar em cada item da sidebar | Cada click leva a pagina correta | [ ] |
| 8.6 | Mobile | Reduzir a janela do navegador para largura de celular (~375px) | Sidebar colapsa. Icone hamburger aparece. Ao clicar, menu abre sobre a pagina | [ ] |

---

## 9. Permissoes (Admin vs Viewer)

> **Contexto:** o app tem dois perfis de usuario. **Admin** tem acesso total, incluindo acoes como recalcular scores. **Viewer** so visualiza dados. O perfil e determinado pela coluna `role` na tabela `user_client_access`. Alem disso, cada usuario so ve dados dos seus proprios clientes (isolamento por RLS — Row Level Security no banco de dados).

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 9.1 | Admin — botao recalcular | Logar como admin, ir ao Dashboard | Botao "Recalcular" visivel e funcional | [ ] |
| 9.2 | Viewer — sem botao | Logar como viewer, ir ao Dashboard | Botao "Recalcular" NAO aparece | [ ] |
| 9.3 | Ambos veem Dashboard | Logar com cada perfil e acessar `/` | KPIs e graficos visiveis para ambos | [ ] |
| 9.4 | Isolamento de dados | Logar com dois usuarios diferentes e comparar `/clients` | Cada usuario ve apenas seus proprios clientes | [ ] |
| 9.5 | RLS enforcement (tecnico) | No DevTools, verificar respostas das RPCs | Nenhuma RPC retorna dados de clientes nao associados ao usuario | [ ] |

---

## 10. Verificacao Anti-Hardcode

> **Contexto:** nenhum valor deve estar fixo ("hardcoded") no codigo. IDs de usuario, URLs, chaves de API e cores devem vir de variaveis, autenticacao ou configuracao. Esta secao pode exigir apoio tecnico.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 10.1 | Sem UUID fixo | No DevTools > Network, verificar todas as chamadas RPC | O campo `p_user_id` em todas as RPCs e o UUID do usuario logado (muda se trocar de conta) | [ ] |
| 10.2 | Sem URL fixa | No DevTools > Network, verificar a URL base das chamadas | URL aponta para `*.supabase.co`, nao para `localhost` ou IP fixo | [ ] |
| 10.3 | API keys protegidas | No DevTools > Sources, buscar por "sk-" ou "service_role" | Nenhuma chave secreta exposta. Apenas a `anon key` (publica) deve aparecer | [ ] |
| 10.4 | Cores consistentes | Visualmente comparar badges de tom em diferentes paginas | "Critico" e sempre vermelho, "Ok" e sempre verde, etc. Consistente em todas as telas | [ ] |
| 10.5 | Cache configurado (tecnico) | Verificar que dados nao ficam infinitamente em cache | Ao alterar dados no banco e esperar ~5 min, Dashboard deve refletir mudancas | [ ] |
| 10.6 | Parametros de busca | Usar filtros na busca e verificar no Network | Todos os parametros (query, clientId, tone, page) sao enviados na RPC. Nenhum hardcoded | [ ] |

---

## 11. Dark Mode (transversal)

> **Contexto:** toda a aplicacao suporta dois temas (claro e escuro). O testador deve verificar que TODAS as paginas sao legiveis e bonitas em ambos os modos. Problemas comuns: texto invisivel (branco no branco), graficos com cores que somem, badges sem contraste.

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 11.1 | Toggle sem flash | Alternar dark/light em cada pagina | Transicao suave. Sem flash branco momentaneo | [ ] |
| 11.2 | Graficos recharts | Verificar todos os graficos em dark mode | Barras, linhas e labels legiveis. Cores distinguiveis no fundo escuro | [ ] |
| 11.3 | Badges de tom | Verificar badges "Ok/Atencao/Alerta/Critico" em dark mode | Fundo escuro (ex: verde escuro para "Ok"), texto claro. Contraste legivel | [ ] |
| 11.4 | Tabelas | Verificar tabelas (Busca, Auditorias) em dark mode | Bordas visiveis, linhas alternadas (se houver), texto legivel | [ ] |
| 11.5 | Skeletons | Forcar loading (recarregar) em dark mode | Animacao shimmer visivel no fundo escuro | [ ] |

---

## 12. Error Boundaries

> **Contexto:** quando algo da errado (erro de rede, bug no codigo, banco fora do ar), a aplicacao deve mostrar uma mensagem amigavel — NUNCA uma tela totalmente branca ou quebrada. O usuario deve sempre ter uma opcao de "tentar novamente".

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 12.1 | Erro por rota | Desconectar internet e navegar entre paginas | Cada pagina mostra erro amigavel (nao tela branca). Botao de retry se aplicavel | [ ] |
| 12.2 | RPC falha | Desconectar internet e recarregar Dashboard | Toast ou alert inline com mensagem de erro. Botao "Tentar novamente" | [ ] |
| 12.3 | Reconexao | Reconectar internet e clicar "Tentar novamente" | Dados carregam normalmente. App volta ao estado funcional | [ ] |

---

## Historico de versoes

| Versao | Data | Alteracoes |
|--------|------|------------|
| v1 | 2026-03-08 | Versao inicial — 67 testes cobrindo 8 rotas, 8 hooks, 5 RPCs |
| v2 | 2026-03-08 | Documento oficial com contexto completo para o testador, glossario, cores de referencia, passos detalhados |

---

## Como enriquecer este checklist

> **REGRA: toda feature nova DEVE adicionar testes aqui ANTES de ser marcada como concluida.**

Ao implementar algo novo:

1. Identifique qual secao o teste pertence (ou crie uma secao nova)
2. Adicione linhas na tabela seguindo o formato:
   ```
   | #.# | Nome do teste | Passos detalhados para o testador | Resultado esperado | [ ] |
   ```
3. Atualize o **total de testes** no cabecalho
4. Adicione uma entrada no **Historico de versoes**
5. Commite junto com o PR da feature

**Exemplo:** se adicionarmos notificacoes por email:
```
## 13. Notificacoes (nova secao)

> **Contexto:** [explicar o que e e como funciona]

| # | Teste | Passos | Resultado esperado | Status |
|---|-------|--------|-------------------|--------|
| 13.1 | Receber notificacao | ... | ... | [ ] |
```
