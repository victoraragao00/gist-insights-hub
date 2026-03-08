# BRIEFING PARA O MEGA AGENTE — Sprint P1 + P3
# CX Hub uMode — 2026-03-08

> Este briefing deve ser entregue ao MA para que ele proponha um plano executivo completo.
> O plano retorna para validação do Claude Code antes de qualquer execução.

---

## CONTEXTO DO PROJETO

**Repo:** https://github.com/HyTrackWater/gist-insights-hub
**Supabase project ref:** qyfwbmukylyfsgzgocfo
**Stack:** React + Tailwind (Cursor) | Supabase PostgreSQL + Edge Functions (Lovable)
**Design System:** `docs/DESIGN_SYSTEM.md` — fonte única de verdade para cores, motion, componentes
**Regras do Cursor:** `.cursor/rules` — carregado automaticamente
**Estado completo do projeto:** CONTEXT.md (v16) no repositório

---

## DIVISÃO DE RESPONSABILIDADES (INVIOLÁVEL)

| Domínio | Agente |
|---------|--------|
| Migrations, Edge Functions, DB Functions | **Lovable exclusivo** |
| Componentes React, hooks, páginas | **Cursor exclusivo** |
| `src/integrations/supabase/*` | Nenhum toca — auto-gerado |

**P1 e P3 são 100% frontend.** O backend já existe. Não há migration nova. O agente é o **Cursor**.

---

## SPRINT: P1 + P3

### P1 — Edição de cliente (status + campos editáveis)

**Problema:**
O campo `status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'trial', 'inativo'))` foi criado via migration (Issue #54). Os filtros e badges foram atualizados (PRs #55 e #56). Porém **não existe nenhuma UI para editar** o status ou outros campos do cliente.

**O que deve ser editável nesta sprint:**
- `status` (ativo / trial / inativo) — seletor
- `name` — texto livre
- `clients.metadata->>'scope'` — texto livre (escopo contratado)
- `client_priority_config.tier` (azzas / enterprise / medium / small) — seletor

**Onde fica:**
ClientDetailPage → aba **Configurações** (já existe, atualmente é placeholder ou tem conteúdo limitado).

**Comportamento esperado:**
- Formulário inline ou Sheet lateral — usar Sheet se quiser manter contexto da página visível (ver Design System seção 3.1)
- `useMutation` para escrita (checklist m9)
- Toast sonner no sucesso/erro (checklist m3)
- Apenas usuários com `role = 'admin'` podem editar (usar hook `useUserRole` já existente)
- Viewers veem os campos em modo read-only
- Após salvar: invalidar queries de `clients` e `client_priority_config`

**Cores do badge de status (Design System 1.x — adicionar):**
- `ativo` → `text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950`
- `trial` → `text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950`
- `inativo` → `text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-950`

---

### P3 — CRUD de Audit Rules

**Problema:**
A tabela `audit_rules` existe com 39 regras seedadas. A página Auditorias (`/audits`, PR #51) exibe alertas disparados via `audit_alerts_summary()`. Porém **não existe UI para criar, editar ou deletar regras**.

**Schema relevante:**
```sql
audit_rules (
  id UUID,
  name TEXT,
  description TEXT,
  client_id UUID REFERENCES clients(id), -- NULL = aplica a todos
  active BOOLEAN DEFAULT true,
  metric TEXT,  -- ver lista abaixo
  operator TEXT CHECK (operator IN ('>=', '<=', '>', '<', '==', 'change_pct_up', 'change_pct_down')),
  threshold FLOAT,
  window_hours INT DEFAULT 24,
  alert_channel alert_channel, -- 'email' | 'whatsapp' | 'both'
  alert_recipients JSONB, -- [{"type":"email","value":"..."}, {"type":"whatsapp","value":"..."}]
  cooldown_hours INT DEFAULT 24,
  created_at TIMESTAMPTZ
)
```

**Métricas disponíveis** (expor todas na UI — o backend `evaluate-audit-rules` calcula todas):
```
score_prioridade    — score de prioridade do cliente
tom_critico_pct     — % de msgs com tom crítico
tom_alerta_pct      — % de msgs com tom alerta
volume_periodo      — volume total de msgs no período
tone_critico_count  — contagem absoluta de msgs críticas
tone_alerta_count   — contagem absoluta de msgs alerta
tone_atencao_count  — contagem absoluta de msgs atenção
out_of_scope_pct    — % fora do escopo contratado
volume_daily        — volume diário
after_hours_count   — msgs fora do horário comercial
response_time_avg   — tempo médio de resposta em minutos
```

**RLS já implementada:**
- SELECT: todos com acesso
- INSERT/UPDATE/DELETE: apenas `role = 'admin'`

**O que a UI deve ter:**

**Aba "Regras" na página /audits:**
- Tabela listando todas as regras (nome, cliente, métrica, operador, threshold, ativo/inativo)
- Botão "Nova Regra" → abre Dialog com formulário (ver Design System 3.1 — Dialog para formulário rico)
- Botão "Editar" por linha → mesmo Dialog com campos preenchidos
- Toggle ativo/inativo por linha (sem modal de confirmação — ação reversível)
- Botão "Deletar" → AlertDialog de confirmação (ação destrutiva)
- Apenas admins veem os botões de ação; viewers veem tabela read-only

**Formulário de regra (campos):**
- Nome (texto)
- Descrição (texto, opcional)
- Cliente (seletor — lista de clientes ativos + opção "Todos os clientes" para NULL)
- Métrica (seletor com os 11 slugs acima + label legível)
- Operador (seletor: `>=`, `<=`, `>`, `<`, `==`)
- Threshold (número)
- Janela em horas (número, default 24)
- Canal de alerta (seletor: email / whatsapp / ambos)
- Destinatários (campo dinâmico: adicionar/remover pares tipo+valor)
- Cooldown em horas (número, default 24)

**Comportamento:**
- `useMutation` para criar/editar/deletar/toggle (checklist m9)
- Toast sonner no sucesso/erro (checklist m3)
- Após qualquer mutação: invalidar query de `audit_rules`
- queryKey completo incluindo todos os filtros ativos (checklist m5)
- staleTime 30s (dado dinâmico) (checklist m4)

---

## CHECKLIST CTO OBRIGATÓRIO (verificar em todo PR)

```
m1:  Zero `any` fora de UI
m2:  ErrorBoundary em toda rota
m3:  Toast único (sonner) — sem use-toast, sem <Toaster> duplicado
m4:  staleTime > 0 (30s para dados dinâmicos como audit_rules)
m5:  queryKey completo — toda dependência inclusa
m6:  useRef em vez de DOM IDs estáticos
m7:  Guard contra chamadas duplas
m8:  Erros Supabase tratados — { data, error } sempre destructurado
m9:  useMutation para escrita
m10: refetch() não descartado
m11: Zero imports não usados
m12: Paginação real em listas > 50 itens
m13: Testes em caminhos críticos
```

---

## ANTI-PADRÕES PROIBIDOS

- `use-toast` ou `<Toaster>` duplicado — usar apenas `sonner`
- `any` fora de componentes UI
- Arbitrary values Tailwind (`w-[347px]`) — proibido
- `id="..."` estático em formulários — usar `useRef`
- Cores Tailwind fora da paleta semântica do Design System
- `Drawer` — proibido (usar `Sheet`)
- Duplicar componentes custom existentes: `KPICard`, `ErrorBoundary`, `InteractionsFeed`, `NavLink`, `AppSidebar`

---

## O QUE O MA DEVE ENTREGAR

O MA deve propor um **plano executivo** contendo:

1. **Divisão em Issues** — quantas Issues, para qual agente (Cursor), o que cada uma cobre
2. **Sequência de execução** — qual vem primeiro e por quê (dependências)
3. **Arquivos impactados** — lista por Issue dos arquivos que serão criados ou modificados
4. **Hooks novos** — quais hooks precisam ser criados, com assinatura (return type, queryKey, staleTime, enabled)
5. **Componentes novos** — quais componentes/páginas serão criados ou modificados
6. **Checklist CTO por Issue** — quais itens (m1–m13) são relevantes para cada Issue
7. **Riscos** — o que pode dar errado e como mitigar

O MA **NÃO deve** gerar código nesta etapa. Apenas o plano.
O plano retorna para o **Claude Code validar** antes de qualquer execução.

---

## RESTRIÇÕES FINAIS

- Nenhum arquivo em `src/integrations/supabase/*` deve ser tocado
- Nenhum arquivo em `supabase/migrations/*` deve ser tocado
- `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md` são read-only para todos os agentes
- Todo código submetido via PR para review do Claude Code antes do merge
- Links para agentes: SEMPRE link público GitHub, NUNCA caminho local
