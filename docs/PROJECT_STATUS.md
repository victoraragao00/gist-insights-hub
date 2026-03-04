# 📋 Project Status — Hub de Integrações Multi-App

> **Versão:** v0.3.0  
> **Data:** 2026-03-04  
> **Ambiente:** Lovable Cloud (Supabase managed)  
> **Supabase Project ID:** `qyfwbmukylyfsgzgocfo`

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | React | 18.3.x |
| Linguagem | TypeScript | 5.x |
| Bundler | Vite | 5.x |
| CSS | Tailwind CSS + tailwindcss-animate | 3.x |
| Componentes UI | shadcn/ui (Radix primitives) | latest |
| Data Fetching | TanStack React Query | 5.83.x |
| Roteamento | React Router DOM | 6.30.x |
| Gráficos | Recharts | 2.15.x |
| Backend | Supabase (PostgreSQL + Edge Functions) | 2.98.x SDK |
| Validação | Zod + React Hook Form | 3.x / 7.x |
| Animações | Framer Motion | não instalado ainda |

---

## 2. Estrutura de Arquivos

```
src/
├── App.tsx                    # Router principal
├── main.tsx                   # Entry point
├── index.css                  # Design tokens (CSS vars)
├── components/
│   ├── AppSidebar.tsx         # Sidebar de navegação
│   ├── DashboardLayout.tsx    # Layout wrapper com sidebar
│   ├── GistTestPanel.tsx      # Painel de teste da API Gist
│   ├── KPICard.tsx            # Card reutilizável de KPI
│   ├── NavLink.tsx            # Link de navegação
│   └── ui/                    # ~40 componentes shadcn/ui
├── hooks/
│   ├── useGistKPIs.ts         # Hook: busca KPIs live do Gist
│   ├── use-mobile.tsx         # Hook: detecção de mobile
│   └── use-toast.ts           # Hook: sistema de toasts
├── pages/
│   ├── Index.tsx              # Dashboard principal (KPIs live)
│   ├── Integrations.tsx       # Marketplace de integrações
│   ├── Indicators.tsx         # Builder de indicadores (placeholder)
│   ├── Audits.tsx             # Sistema de alertas (placeholder)
│   ├── Insights.tsx           # Insights IA (placeholder)
│   ├── SettingsPage.tsx       # Configurações (placeholder)
│   └── NotFound.tsx           # 404
├── integrations/supabase/
│   ├── client.ts              # Cliente Supabase (auto-gerado)
│   └── types.ts               # Types do banco (auto-gerado)
└── lib/
    └── utils.ts               # Utilitários (cn, etc.)

supabase/
├── config.toml                # Config do projeto (auto-gerado)
└── functions/
    └── gist-proxy/
        └── index.ts           # Edge Function: proxy para API Gist

docs/
└── PROJECT_STATUS.md          # Este arquivo
```

---

## 3. Rotas da Aplicação

| Rota | Página | Status |
|------|--------|--------|
| `/` | Dashboard (KPIs) | ✅ Live — dados reais do Gist |
| `/integrations` | Marketplace de integrações | ⚠️ UI-only — modal não persiste no banco |
| `/indicators` | Builder de indicadores | 🔲 Placeholder — empty state |
| `/audits` | Auditorias e alertas | 🔲 Placeholder — empty state |
| `/insights` | Insights IA | 🔲 Placeholder — empty state |
| `/settings` | Configurações | 🔲 Placeholder — empty state |

---

## 4. Banco de Dados

### 4.1 Enums

```sql
CREATE TYPE public.platform_type AS ENUM (
  'gist', 'stripe', 'linear', 'notion', 'tudo1', 'whatsapp', 'slack', 'custom'
);

CREATE TYPE public.auth_type AS ENUM ('api_key', 'oauth', 'token');

CREATE TYPE public.metric_type AS ENUM ('count', 'sum', 'avg', 'percentage', 'custom');

CREATE TYPE public.chart_type AS ENUM ('line', 'bar', 'donut', 'number');

CREATE TYPE public.condition_type AS ENUM ('threshold', 'percentage_change', 'compound');
```

### 4.2 Tabelas

#### `integrations`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| user_id | uuid | No | — |
| platform | platform_type | No | — |
| name | text | No | — |
| auth_type | auth_type | No | 'api_key' |
| credentials | jsonb | No | '{}' |
| config | jsonb | No | '{}' |
| status | text | No | 'active' |
| created_at | timestamptz | No | now() |

**RLS:** `auth.uid() = user_id` (ALL operations)

#### `data_sources`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| integration_id | uuid | No | — (FK → integrations.id) |
| endpoint_path | text | No | — |
| label | text | No | — |
| data_schema | jsonb | No | '{}' |
| sync_interval | integer | No | 300 |
| last_synced_at | timestamptz | Yes | — |
| is_enabled | boolean | No | true |

**RLS:** Verifica via JOIN se `integrations.user_id = auth.uid()` (ALL operations)

#### `kpi_indicators`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| user_id | uuid | No | — |
| name | text | No | — |
| data_source_id | uuid | Yes | — (FK → data_sources.id) |
| metric_type | metric_type | No | 'count' |
| formula | text | Yes | — |
| filters | jsonb | No | '{}' |
| chart_type | chart_type | No | 'number' |
| created_at | timestamptz | No | now() |

**RLS:** `auth.uid() = user_id` (ALL operations)

#### `alert_rules`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| user_id | uuid | No | — |
| kpi_indicator_id | uuid | No | — (FK → kpi_indicators.id) |
| condition_type | condition_type | No | 'threshold' |
| conditions | jsonb | No | '{}' |
| notification_channels | jsonb | No | '[]' |
| is_active | boolean | No | true |
| cooldown_minutes | integer | No | 60 |
| created_at | timestamptz | No | now() |

**RLS:** `auth.uid() = user_id` (ALL operations)

#### `alert_logs`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| alert_rule_id | uuid | No | — (FK → alert_rules.id) |
| triggered_at | timestamptz | No | now() |
| value_at_trigger | numeric | Yes | — |
| notification_sent_to | jsonb | No | '[]' |

**RLS:** SELECT only, via JOIN com `alert_rules.user_id = auth.uid()`

### 4.3 Observações sobre RLS

- ⚠️ **TODAS** as policies usam `RESTRICTIVE` (não permissive)
- ⚠️ **Auth não implementada no frontend** → nenhuma operação de escrita funciona atualmente
- Não há functions nem triggers no banco

---

## 5. Edge Functions

### `gist-proxy`

| Propriedade | Valor |
|-------------|-------|
| Caminho | `supabase/functions/gist-proxy/index.ts` |
| JWT Verify | `false` (acessível sem auth) |
| Secret usada | `GIST_API_KEY` |
| Base URL | `https://api.getgist.com` |

**Endpoints permitidos:**
- `contacts` — lista contatos (suporta paginação)
- `conversations` — lista conversas (filtro por `state`)
- `campaigns` — lista campanhas
- `tags` — lista tags
- `segments` — lista segmentos
- `teammates` — lista teammates
- `token` — verifica token

**Comportamento:**
- Recebe `{ endpoint, params }` no body
- Valida endpoint contra whitelist
- Faz GET para Gist API com Bearer auth
- Trata respostas não-JSON (retorna 502)
- CORS habilitado para todas as origens

---

## 6. Status das Features

### ✅ Implementado e Funcional

| Feature | Detalhes | Dados |
|---------|----------|-------|
| Dashboard KPIs | 6 cards com métricas do Gist | 🟢 LIVE — API real |
| Gist Proxy | Edge function para comunicação segura | 🟢 LIVE |
| Sidebar Navigation | 6 seções com ícones | 🟢 LIVE |
| Layout Responsivo | DashboardLayout + AppSidebar | 🟢 LIVE |
| Painel de Teste Gist | Tabelas com dados raw da API | 🟢 LIVE |

### ⚠️ UI Implementada, Sem Persistência

| Feature | Detalhes | Problema |
|---------|----------|----------|
| Marketplace Integrações | Grid de 8 plataformas + modal de conexão | Modal usa `setTimeout` fake, não salva no banco |
| Formulário de API Key | Aceita input do usuário | Dados descartados (sem auth = sem RLS = sem write) |

### 🔲 Placeholder (Empty State)

| Feature | Página | Descrição |
|---------|--------|-----------|
| Builder de Indicadores | `/indicators` | Tela vazia com botão "Novo Indicador" |
| Auditorias/Alertas | `/audits` | Tela vazia |
| Insights IA | `/insights` | Tela vazia |
| Configurações | `/settings` | Tela vazia |

---

## 7. Dados Reais vs Mocados

| Componente | Tipo de Dado | Fonte |
|-----------|-------------|-------|
| Dashboard KPIs | 🟢 Real | API Gist via `gist-proxy` Edge Function |
| Gist Test Panel | 🟢 Real | API Gist via `gist-proxy` Edge Function |
| Lista de plataformas | 🔴 Estático | Array hardcoded no componente Integrations.tsx |
| Status de conexão | 🔴 Mocado | Estado local do React (não consulta banco) |
| Modal de conexão | 🔴 Mocado | `setTimeout` simulando conexão, dados descartados |

---

## 8. Secrets Configuradas

| Secret | Status | Uso |
|--------|--------|-----|
| `GIST_API_KEY` | ✅ Configurada | Edge Function `gist-proxy` |
| `SUPABASE_URL` | ✅ Auto | Infraestrutura |
| `SUPABASE_ANON_KEY` | ✅ Auto | Infraestrutura |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Auto | Infraestrutura |
| `SUPABASE_DB_URL` | ✅ Auto | Infraestrutura |
| `LOVABLE_API_KEY` | ✅ Auto | AI Gateway |
| `GEMINI_API_KEY` | ❌ Não configurada | Necessária para Insights IA (Fase 5) |

---

## 9. Bloqueadores Atuais

### 🚨 CRÍTICO: Autenticação não implementada

- **Impacto:** Todas as tabelas têm RLS ativo. Sem `auth.uid()`, nenhuma operação de INSERT/UPDATE/DELETE funciona.
- **Consequência:** O modal de conexão de integrações não pode salvar no banco. KPI Builder não pode persistir indicadores. Alertas não podem ser criados.
- **Solução:** Implementar signup/login com Supabase Auth + contexto de autenticação + rotas protegidas.

### ⚠️ Edge Function `generic-api-proxy` não criada

- **Impacto:** Apenas Gist funciona como integração. Outras plataformas não têm proxy.
- **Solução:** Criar edge function genérica que lê credenciais do banco e faz chamadas para qualquer API.

---

## 10. Roadmap (Ordem de Prioridade)

| # | Fase | Descrição | Dependência |
|---|------|-----------|-------------|
| 1 | 🔴 Auth | Signup/Login, AuthContext, rotas protegidas, redirect | Nenhuma |
| 2 | 🟡 Persistir Integrações | Modal salva no banco, lista integrações do user, desconectar | Auth |
| 3 | 🟡 Generic API Proxy | Edge function que lê credentials do banco e faz proxy para qualquer API | Auth + Integrações |
| 4 | 🟡 KPI Builder | Formulário visual: fonte → métrica → filtros → gráfico → salvar | Auth + Data Sources |
| 5 | 🟡 Dashboard Dinâmico | Grid editável com KPIs persistidos do usuário | KPI Builder |
| 6 | 🟡 Auditorias | Wizard de regras, condições compostas, seleção de canais | KPIs |
| 7 | 🟡 Cron check-alerts | Edge function periódica que avalia regras e dispara notificações | Auditorias |
| 8 | 🟡 send-notification | Edge function para WhatsApp/Email/Slack | check-alerts |
| 9 | 🔵 Insights IA | Análise cross-platform com Gemini/Lovable AI | KPIs + GEMINI_API_KEY |
| 10 | 🔵 Refinamentos | Filtros globais, skeletons, logs de sync, responsividade | Tudo |

---

## 11. Changelog

### v0.3.0 — 2026-03-04
- ✅ Dashboard com 6 KPIs live do Gist (useGistKPIs hook)
- ✅ Componente KPICard reutilizável com skeleton loading
- ✅ Integração real com API Gist via edge function

### v0.2.0 — 2026-03-03
- ✅ Banco de dados criado (5 tabelas + 5 enums + RLS)
- ✅ Sidebar reestruturada (6 seções do hub)
- ✅ Página Integrações com marketplace UI (8 plataformas)
- ✅ Modal de conexão (UI-only, sem persistência)
- ✅ Rotas configuradas para todas as páginas

### v0.1.0 — 2026-03-02
- ✅ Projeto inicializado com Lovable
- ✅ Edge Function `gist-proxy` criada e deployada
- ✅ Painel de teste do Gist funcional
- ✅ Secret `GIST_API_KEY` configurada

---

## 12. Informações para o Agente Externo

### Como rodar
- Projeto hospedado no Lovable (não roda localmente)
- Preview: gerenciado pelo Lovable
- Edge functions: deploy automático pelo Lovable Cloud

### Padrões de código
- Componentes: functional components com TypeScript
- Estilização: Tailwind CSS com design tokens semânticos (CSS vars em `index.css`)
- Data fetching: TanStack Query (useQuery/useMutation)
- Formulários: React Hook Form + Zod
- UI: shadcn/ui (importar de `@/components/ui/`)
- Cliente DB: `import { supabase } from "@/integrations/supabase/client"`
- Tipos DB: auto-gerados em `src/integrations/supabase/types.ts` (NÃO editar)

### Arquivos que NÃO devem ser editados
- `src/integrations/supabase/client.ts` (auto-gerado)
- `src/integrations/supabase/types.ts` (auto-gerado)
- `supabase/config.toml` (auto-gerado)
- `.env` (auto-gerado)
- `supabase/migrations/` (gerenciado por migration tool)
