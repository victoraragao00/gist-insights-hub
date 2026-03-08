# CONTEXT.md — Estado do Projeto (v7 — 2026-03-08)

> Mantido pelo Claude Code ao final de cada sessao. Lido por todos os agentes para manter contexto.
>
> last_updated: 2026-03-08
> last_updated_by: Claude Code

---

## Estado das Fases

| Fase | Descricao | Status |
|------|-----------|--------|
| 0 | Auth (signup/login, RLS) | Concluido |
| 1 | Modelo de dados CX (clients, participants, interactions, sync_jobs) | Concluido |
| 2 | Integracoes Gist (proxy, bindings, discover, confirm-mapping) | Concluido |
| 3 | Sync Engine (enqueue + process-jobs worker) | Concluido |
| 4 | Classificacao IA (classify_batch via Gemini/Claude) | Concluido — Gemini Pro + prompt Mega Agente v6 |
| 5 | Dashboard e KPIs | Em progresso — Cursor assumiu frontend, auditoria de UI/UX concluida |
| 6 | Auditorias e Alertas | Placeholder |
| 7 | Insights IA avancados | Placeholder |

---

## Reclassificacao do Backlog

- **Status:** Em andamento (~45% concluido)
- **Classificadas:** ~14.870 de ~33.091 msgs
- **Conversas pendentes:** ~887
- **Jobs executados:** 4 classify_batch (Gemini Pro + v6)
- **Modelo:** gemini-2.5-pro, 3 timeouts de Gemini (normal)
- **Previsao:** mais 1-2 jobs para finalizar

---

## Issues

| # | Issue | Status | Responsavel |
|---|-------|--------|-------------|
| #2-#10 | Bugs iniciais (proxy, safety filter, realtime, timeouts, attachments) | Resolvidos | Lovable |
| #11 | Migration: conversation_id column + backfill + index | Resolvido | Lovable |
| #12 | classify_batch por conversa (nao por mensagem isolada) | Resolvido | Lovable |
| #13 | Banner de reclassificacao (opcional) | Aberto | Lovable |
| #14 | Calibracao de tom + filtro 365d | Resolvido | Lovable |
| #15 | Prompt Mega Agente v3 | Resolvido | Lovable |
| #16 | Gemini Pro definitivo + prompt v6 com few-shot examples | Resolvido | Lovable |

---

## Divida Tecnica (auditoria Cursor — 2026-03-08)

Violacoes do Checklist do CTO encontradas no codigo atual:

| Item | Problema | Onde | Severidade |
|------|----------|------|-----------|
| m1 | `any` em codigo nao-UI | InteractionsFeed, ClientContext, SettingsPage | Alta |
| m3 | `use-toast.ts` e `ui/toaster.tsx` existem (nao usados, bomba relogio) | src/components/ui/ | Media |
| m4 | staleTime ausente em 6 queries | ClientDetailPage | Alta |
| m5 | invalidateQueries sem `user?.id` na key | ClientDetailPage | Media |
| m9 | useState manual em vez de useMutation (3 handlers) | ClientDetailPage, SettingsPage | Alta |
| m12 | Sem paginacao real (limit 100/200 hardcoded) | ClientsPage, ClientDetailPage | Alta |
| m6 | DOM IDs estaticos em inputs | LoginPage, SignupPage | Baixa |

## Problemas de UX identificados

- Dashboard mostra KPIs do Gist mas nao reflete dados de classificacao IA (tom, tema, tendencias)
- Excesso de botoes "Em breve" — transmite produto inacabado
- Pagina Auditorias e placeholder sem funcionalidade
- Coluna "Saude" com semantica invertida (mais % = mais vermelho)
- Marca inconsistente (Login diz "Hub Central", sidebar diz "uMode")
- 404 em ingles, app em PT-BR

---

## Arquitetura

### Sync Engine
- **Padrao enqueue -> worker:** Edge Functions criam jobs via RPC `create_job_if_none_active`. `process-jobs` e o worker generico.
- **Job types:** `sync_contacts`, `ingest_historical`, `classify_batch`
- **Auto-chain:** `has_more: true` dispara nova invocacao. `pg_cron` e rede de seguranca.

### IA / Classificacao (v6 — Mega Agente + Gemini Pro)
- **Modelo definitivo:** `gemini-2.5-pro` (custo ~$2/ano, qualidade superior)
- **Fallback:** `claude-sonnet-4` via `CLAUDE_API_KEY`
- **Unidade de classificacao:** conversa (thread completa), nao mensagem isolada
- **Coluna `conversation_id`:** materializada, indexada
- **Batch:** 10 conversas/batch (~200 msgs), propagacao para todas as mensagens
- **Prompt Mega Agente:** contexto uMode (B2B textil/moda), rubrica de tom 4 niveis, 8 regras anti-vies, desambiguacao de 14 temas, 4 few-shot examples
- **Filtro temporal:** 365 dias
- **Safety filter:** marca defaults com `gemini-safety-default`
- **Timeout:** 55s Gemini, 45s Claude
- **JSON recovery:** `parseWithRecovery()`
- **Auto-chain limit:** `MAX_BATCHES_PER_JOB = 50`

### Auditoria de Qualidade (blind tests com 32 conversas)

| Versao | Modelo | Prompt | Nota | Tom | Tema |
|--------|--------|--------|------|-----|------|
| v2 | Flash | Original | 7.9 | 52% | 79% |
| v3 | Flash | Mega Agente | 8.8 | 75% | 84% |
| v4 | Claude Sonnet (cego) | Mega Agente | 8.6 | 72% | 78% |
| v5 | Pro | Mega Agente | 8.8 | 81% | 81% |
| **v6** | **Pro** | **Mega Agente + few-shot** | **9.0** | **84%** | **84%** |

**Conclusao:** Gemini Pro + Mega Agente v6 e a versao definitiva. Nota 9.0/10, primeiro acima de 9. Claude performou pior com o mesmo prompt (8.6). Custo mensal ~$0.16.

### Volume e Custos
- **Backlog:** ~33k msgs em ~1.680 conversas (~45% ja classificado)
- **Volume mensal:** ~117 conversas/mes (media ultimos 6 meses, tendencia crescente)
- **Custo Gemini Pro:** ~$2.22 backlog + ~$0.16/mes recorrente (~$2/ano)

---

## Colaboracao

Papeis, restricoes, fluxos e checklist completos em AGENTS.md (v6).

| Agente | Papel | Canal |
|--------|-------|-------|
| **Claude Code** | Revisao e Engenharia | Terminal / CLI |
| **Cursor** | Desenvolvimento Frontend | Cursor IDE |
| **Lovable** | Migrations e Edge Functions (escopo reduzido) | Interface Lovable |
| **Projeto** | Auditoria e Estrategia | claude.ai |
| **Operador** (Joao) | Orquestrador Humano | Supabase Dashboard / GitHub |

### Mudanca de estrategia (2026-03-08)
- **Cursor assumiu o frontend** para reduzir dependencia e custo do Lovable
- **Lovable fica restrito** a migrations, edge functions e deploy no Supabase
- **Claude Code revisa** todo codigo do Cursor contra Checklist do CTO
- **Plano de independencia:** migrar ownership do Supabase project para conta propria (futuro)

### Preferencias do Operador
- Respostas diretas e concisas — sem enrolacao
- Conteudo self-contained para copy-paste — nunca pedir para intermediar
- Nao dar estimativas de tempo — focar no que precisa ser feito
- Arquivos compartilhados em `~/Desktop/CX HUB/`
- Repo publico: github.com/HyTrackWater/gist-insights-hub

---

## Proximos Passos

1. **Em andamento:** Reclassificacao do backlog (~55% pendente, mais 1-2 jobs)
2. **Proximo:** Corrigir divida tecnica do Checklist CTO (m1, m3, m4, m5, m9, m12)
3. **Fase 5:** Dashboard com dados classificados (tom, tema, tendencias)
4. **Fase 5:** Limpar "Em breve", alinhar marca, corrigir UX
5. **Fase 6:** Auditorias e Alertas
6. **Fase 7:** Insights IA avancados
