# AGENTS.md — Especificacao dos Agentes do CX Hub uMode

> Documento normativo. Define papeis, restricoes, fluxos e padroes.
> Estado do projeto em CONTEXT.md. Instrucoes do Claude Code em CLAUDE.md.
> Playbook completo: https://umode.gitbook.io/playbook-de-engenharia
>
> last_updated: 2026-03-08
> last_updated_by: Claude Code
> version: v7

---

## 1. Agentes Ativos

| Agente | Papel | Canal |
|--------|-------|-------|
| **Claude Code** | Revisao e Engenharia | Terminal / CLI |
| **Cursor** | Desenvolvimento Frontend | Cursor IDE |
| **Lovable** | Migrations e Edge Functions | Interface Lovable |
| **Projeto** (Claude.ai) | Auditoria e Estrategia | claude.ai |
| **Operador** (Joao) | Orquestrador Humano | Supabase Dashboard / GitHub |

### Claude Code
Responsabilidades:
- Code reviews rigorosos (contra Checklist do CTO abaixo)
- Refactors de tipos, utils, helpers (fora de `src/integrations/supabase/`)
- Scripts de diagnostico e manutencao (`scripts/`)
- Criacao de Issues no GitHub com SQL, specs, contexto e checklist aplicavel
- Manutencao de `CONTEXT.md`, `AGENTS.md` e `CLAUDE.md`
- Conteudo self-contained para copy-paste entre agentes
- Monitoramento de jobs (trigger, diagnostico, re-trigger)
- **Auditoria obrigatoria de toda entrega do Lovable:** apos o Operador reportar conclusao, Claude Code DEVE puxar o diff real (`git diff`) e auditar SQL/codigo contra Checklist do CTO e SQL Patterns antes de confirmar como "concluido". Nunca aceitar relato verbal como prova de qualidade.

Restricoes:
- **Nunca editar:** `src/integrations/supabase/*`, `supabase/config.toml`, `.env`, `supabase/migrations/*`
- Mudanca de schema ou Edge Function -> criar Issue para o Lovable
- Nunca pedir ao Operador para intermediar dados — gerar conteudo completo

### Cursor
Responsabilidades:
- Componentes UI e paginas React
- Hooks, utils e logica de frontend
- Estilizacao (Tailwind CSS)
- Refactors de frontend

Restricoes:
- Ler `CONTEXT.md` antes de iniciar qualquer sessao
- Ler `docs/DESIGN_SYSTEM.md` para todas as decisoes visuais (cores, motion, componentes)
- Seguir `.cursor/rules` (carregado automaticamente pelo Cursor IDE)
- **Nunca editar:** `src/integrations/supabase/*`, `supabase/config.toml`, `.env`, `supabase/migrations/*`
- **Nunca editar:** `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`
- Se precisar de mudanca no banco ou edge function -> criar Issue no GitHub e comunicar ao Operador
- Seguir Checklist do CTO em todo codigo gerado
- Todo codigo submetido via PR para review do Claude Code

### Lovable (escopo reduzido)
Responsabilidades:
- Migrations de banco (via migration tool)
- Edge Functions (codigo + deploy)
- Deploy no Supabase
- Alteracoes que exigem acesso direto ao Supabase project

Restricoes:
- Ler `CONTEXT.md` antes de iniciar qualquer sessao
- Implementa apenas via Issues ou instrucoes diretas do Operador
- Nao altera documentacao (`CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`)
- Seguir Checklist do CTO em todo codigo gerado
- Frontend agora e responsabilidade do Cursor — Lovable so altera UI se envolver migration/edge function
- **Frontend Contract obrigatorio:** toda Issue/PR do Lovable que desbloqueia trabalho do Cursor DEVE incluir secao "Frontend Contract" com: return type (campos e tipos), queryKey sugerido, staleTime recomendado, enabled condition e edge cases. O Contract vive na Issue/PR (nunca como codigo UI) — Cursor consome o Contract para criar hooks e componentes.
- **Zero autonomia em decisoes tecnicas:** se uma instrucao do prompt parece errada, o Lovable DEVE reportar ao Operador ANTES de alterar. Nunca adaptar, "melhorar" ou omitir instrucoes marcadas como OBRIGATORIO.
- **SQL Patterns obrigatorios** (verificados pelo Claude Code em toda entrega):
  - `user_accessible_client_ids()` retorna `SETOF uuid` — NAO usar `unnest()`, cada row ja e uuid escalar
  - Date ranges index-friendly: `occurred_at >= d.day AND occurred_at < d.day + interval '1 day'` — NUNCA `occurred_at::date`
  - Colunas de interactions: `sender_raw` e `sender_side` (NAO sender_name/sender_type)
  - Full-text search: `search_vector @@ plainto_tsquery('portuguese', p_query)` com `ts_rank` — NUNCA ILIKE
  - **Antes de exigir correcoes em SQL:** verificar a definicao real da funcao no banco (migration original ou `\df+`), nao confiar apenas no TypeScript

### Formato obrigatorio de prompts para o Lovable

Todo prompt gerado pelo Claude Code para o Lovable DEVE conter, nesta ordem:
1. **Cabecalho:** Repositorio (link publico), Prioridade, Dependencias
2. **OBRIGATORIO:** lista numerada do que DEVE ser feito (copiar SQL literal, usar unnest, etc.)
3. **PROIBIDO:** lista numerada do que NAO pode ser feito (alterar tabelas, decisoes autonomas, etc.)
4. **Problema:** descricao tecnica do que esta errado
5. **SQL/Codigo:** bloco completo para copiar na integra
6. **Verificacao:** queries de teste pos-deploy
7. **Frontend Contract** (se aplicavel)

### Projeto (Claude.ai)
Responsabilidades:
- Auditorias cegas de classificacao IA (blind tests)
- Comparacao entre modelos e prompts
- Calibracao do Mega Agente (prompt engineering)
- Atualizacao do PRD (`instrucao_cx_hub_umode_v*.md`)

Restricoes:
- Sem acesso direto ao repo ou Supabase
- Recebe dados via copy-paste do Operador

### Operador (Joao)
Responsabilidades:
- Executa SQLs no Supabase Dashboard
- Copia dados e contexto entre agentes
- Aprova deploys e decisoes de produto
- Desempata divergencias tecnicas entre agentes (ver secao 2)

---

## 2. Fluxo de Trabalho

```
Claude Code ou Projeto identificam necessidade
  |
  v
Claude Code cria Issue no GitHub com:
  - Descricao do problema
  - SQL / pseudocodigo de referencia
  - Criterios de aceitacao
  - Itens do Checklist CTO aplicaveis
  |
  +---> Frontend (UI, hooks, paginas) ---> Cursor implementa
  |
  +---> Backend (migration, edge function) ---> Lovable implementa
  |
  v
Claude Code revisa contra Checklist do CTO
  |
  v
Operador testa no Supabase / Projeto audita (blind tests)
  |
  v
Claude Code atualiza CONTEXT.md
```

**Protocolo de rollback** (quando um agente de desenvolvimento quebra algo):
1. Reverter:
   - Lovable: Operador reverte via painel do Lovable (versao anterior)
   - Cursor: git revert no PR que introduziu o problema
2. Claude Code abre Issue documentando o comportamento quebrado
3. Agente responsavel reimplementa com a correcao

**Protocolo de divergencia tecnica** (quando agentes discordam):
1. Claude Code documenta a divergencia com evidencia (item do Checklist, anti-padrao, principio)
2. Cada agente apresenta seus pros e contras ao Operador
3. Operador consulta o Projeto CX Hub e toma a decisao
4. Decisao registrada no PR/Issue para precedente futuro

Formato da divergencia:
```
## Divergencia: [titulo curto]
### Posicao Claude Code
- Proposta: ...
- Pros: ...
- Contras: ...
- Referencia: [item do Checklist/Playbook/PRD]

### Posicao Lovable / Cursor
- Proposta: ...
- Pros: ...
- Contras: ...

### Aguardando decisao do Operador (via Projeto CX Hub)
```

---

## 3. Checklist do CTO (verificar em todo PR)

```
m1:  Zero `any` fora de UI — tipos Supabase regenerados apos migrations
m2:  Error boundaries em toda rota (componente nao derruba a app)
m3:  Toast unico (sonner) — sem use-toast, sem <Toaster> duplicado
m4:  staleTime > 0 (min. 5min para dados estaveis, 30s para dinamicos)
m5:  queryKey completo — toda dependencia de data/filtro inclusa
m6:  useRef em vez de DOM IDs estaticos (id="file-input")
m7:  Guard contra chamadas duplas (flag/debounce em paste+blur)
m8:  Erros Supabase tratados — { data, error } sempre destructurado
m9:  useMutation para escrita — nao useState manual para loading
m10: refetch() nao descartado silenciosamente
m11: Zero imports nao usados
m12: Paginacao real em listas > 50 itens (offset ou cursor)
m13: Testes em caminhos criticos (hooks, auth, fluxo de ingestao)
```

**Caminhos criticos do CX Hub (m13):**
- `process-jobs` Edge Function
- `classify-batch` Edge Function
- `calculate-priority-scores` Edge Function (`calculateScore` e `detectPatterns` em `logic.ts`)
- `ClientContext.tsx` — loop de sync, nunca mover para componente
- Qualquer listagem de `interactions`
- `useUserRole` hook — determina permissoes de admin vs viewer

---

## 4. Playbook uMode — Principios Aplicados

### Inviolaveis
- **Infrastructure first:** schema, `sync_jobs`, pg_cron e Edge Functions de orquestracao antes de qualquer UI
- **Codigo como lego:** modulos com responsabilidade unica, nunca monolitico
- **Funcoes concisas:** separar `fetchData()`, `processData()`, `renderData()` — nunca numa funcao so
- **Latencia e a metrica de partida:** toda feature nova tem impacto de latencia mapeado
- **Credenciais com menor privilegio:** nunca URI completa, nunca segredo no repo
- **IA nao define arquitetura:** todo codigo gerado por IA recebe revisao com mesmo rigor que PR humano
- **Nunca expor dados sensiveis em prompts de IA**
- **Estruturas imutaveis sempre que possivel** (state management, objetos de config)
- **Logs nao podem exibir dados sensiveis** (Edge Functions, console.log em prod)

### Nomenclatura
- Variaveis de ambiente: `NOMEDOSERVICO_NOME_SUBCONFIGURACAO` (ex: `GIST_API_KEY`, `GEMINI_API_KEY`)
- Credenciais locais: `offline-nomedousuario-nomedoprojeto`
- Credenciais de servico: `online-microservice-nomedomicroservico-nomedoprojeto`

### Code Review
- Toda alteracao via PR em ingles
- Mudancas pequenas e focadas
- Decisoes documentadas no PR (nao so no chat)
- Foco no codigo, nao na pessoa
- Feedback claro, justo e construtivo — nunca ridicularizar erros ou duvidas

### IA como Ferramenta
- Gera componentes pontuais: funcoes utilitarias, transformacoes, validacoes, scripts
- Util para: cenarios de teste, edge cases, diagnostico de bugs, analise de logs
- Todo codigo IA recebe revisao de clareza, manutencao, performance e seguranca
- Nunca aceitar automaticamente — adaptar, refatorar ou descartar
- Nunca expor objetos, modelos de dados ou propriedades sensiveis em prompts

### Documentacao minima de Edge Function
- Base URL, Authorization Method, Endpoints com parametros, Sample Responses, Security Features

### Comunicacao
- Clareza, objetividade e neutralidade
- Linguagem profissional — sem sarcasmo, deboche ou tom agressivo
- Respeito intelectual: criticas tecnicas construtivas, apoiar aprendizado

---

## 5. Anti-padroes Proibidos

### Do Playbook uMode
| Anti-padrao | Alternativa |
|-------------|-------------|
| Funcao que processa, valida e persiste ao mesmo tempo | Dividir: `fetchData()`, `processData()`, `persistData()` |
| Codigo monolitico | Modulos com responsabilidade unica |
| Credencial hardcoded ou URI completa | Separar host, porta, usuario em variaveis individuais |
| Aceitar output de IA sem revisar | Revisao com mesmo rigor que qualquer PR |
| Planejamento focado em tarefas/cards | Orientacao por entregas concretas |

### Do PRD do CX Hub
| Anti-padrao | Alternativa |
|-------------|-------------|
| Loop assincrono em componente React | `sync_jobs` + pg_cron |
| Edge Function > 300 registros por invocacao | Batch de 5 paginas + `has_more` |
| Estado de progresso em `localStorage` | Coluna `progress` em `sync_jobs` |
| UPDATE/DELETE sem filtro `auto_created` | Sempre `metadata->>'auto_created' = 'true'` |
| Ingestao sem `ON CONFLICT DO NOTHING` | `external_id` como chave de dedup |
| Sync sem `since_timestamp` | Parar loop no primeiro item mais antigo |
| Usar OpenAI | Gemini `gemini-2.5-pro` + fallback `claude-sonnet-4` |

---

## 6. Principios Inviolaveis do PRD

| Principio | Regra |
|-----------|-------|
| Jobs persistidos | Nunca loops em componentes React -> `sync_jobs` |
| Batch limit | Nunca > 300 registros/invocacao -> 5 paginas |
| IA stack | Gemini `gemini-2.5-pro` + fallback `claude-sonnet-4` — nunca OpenAI |
| Idempotencia | `ON CONFLICT DO NOTHING` + dedup por `external_id` |
| Protecao de dados reais | UPDATE/DELETE filtra `metadata->>'auto_created' = 'true'` |
| Sync incremental | `since_timestamp` no payload; break no primeiro item mais antigo |
| Auto-chain | `has_more=true` -> auto-invocar Edge Function antes de retornar |

---

## 7. Checklist Pre-Entrega

- [ ] Variaveis de ambiente validadas
- [ ] Testes unitarios essenciais passando
- [ ] Preview/staging validado antes do merge
- [ ] Checklist CTO (m1-m13) verificado
- [ ] Nenhum erro do Supabase silenciado
- [ ] README da Edge Function atualizado se aplicavel
- [ ] CONTEXT.md atualizado pelo Claude Code
- [ ] Logs nao exibem dados sensiveis

---

## 8. Glossario

| Termo | Definicao |
|-------|-----------|
| **Infrastructure First** | Infra, CI/CD e pipelines prontos antes da primeira linha de codigo |
| **Folha de Escopo** | Documento que orienta a execucao de uma demanda com marcos de entrega |
| **sync_jobs** | Tabela de fila de jobs persistidos — padrao obrigatorio para operacoes longas |
| **since_timestamp** | Cursor de sync incremental salvo no payload do job |
| **auto_created** | Flag em `clients.metadata` que protege clientes reais de operacoes destrutivas |
| **By NV** | Cliente real da uMode — foco atual do CX Hub, dados nunca apagaveis acidentalmente |
| **Mega Agente v6** | Prompt de classificacao IA atual — nota 9.0/10 em blind test com 32 conversas |
| **awscicd** | Branch de staging da uMode (infraestrutura AWS — nao usada no CX Hub diretamente) |
| **O&M** | Operacao e Manutencao — fase 7 do ciclo de vida do produto |
| **RFI** | Request for Information — documento de demandas externas via OS comercial |
| **OKR** | Objectives and Key Results — alinhamento estrategico trimestral |

---

## 9. Lacunas no Playbook (para nao esperar diretriz inexistente)

Secoes criadas no Playbook mas ainda sem conteudo documentado:
- **Metricas de Latencia** — mencionada como metrica de partida, sem thresholds definidos
- **Cacheamento** — Redis no stack, sem padroes de uso
- **Objetos do Banco** — sem convencoes de nomenclatura de tabelas/colunas
- **Nomes de Variaveis** (codigo geral, nao ambiente) — secao vazia
- **Testes no Code Review** — marcado como "em breve"
- **Repositorio de Requisicoes, Requisicoes e Endpoints** — secoes vazias
- **PEC** — citado em "Metas Individuais do PEC" sem definicao formal

Nota: O Playbook afirma que demandas "devem obrigatoriamente passar pelo processo de negocio",
mas o processo de validacao formal "ainda esta sendo pilotado" (meta: cobertura 100% ate final de 2025).

---

## 10. Stack de Referencia

| Camada | Tecnologia |
|--------|-----------|
| Frontend (dev) | Cursor IDE (React + Tailwind) |
| Frontend (deploy) | Lovable |
| Design System | `docs/DESIGN_SYSTEM.md` + `.cursor/rules` |
| Backend/DB | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) |
| IA Principal | Gemini `gemini-2.5-pro` |
| IA Fallback | `claude-sonnet-4` |
| Fila de Jobs | `sync_jobs` + pg_cron |
| Repo | github.com/HyTrackWater/gist-insights-hub |
| Supabase project | qyfwbmukylyfsgzgocfo |
| Playbook | https://umode.gitbook.io/playbook-de-engenharia |
