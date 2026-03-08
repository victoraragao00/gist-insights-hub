# INSTRUÇÃO DE PRODUTO — CX Hub uMode

## Meta-Instrução para IA / Lovable

> Este documento é a especificação completa de um produto. Ele deve ser usado como contexto principal em qualquer sessão de desenvolvimento com Lovable, Claude, Cursor ou qualquer assistente de código. Ao iniciar uma sessão, cole este documento e diga: "Este é o PRD do projeto. Siga as instruções exatamente como descritas."

---

## 1. VISÃO DO PRODUTO

### 1.1 O que é

O **CX Hub** é uma plataforma interna da uMode Tecnologia para gestão de Customer Experience. Ele centraliza TODAS as interações entre a uMode e seus clientes — vindas de múltiplos canais — em uma base de dados unificada com classificação automática por IA.

### 1.2 Problema que resolve

Hoje a uMode atende clientes de forma fragmentada: WhatsApp pessoal, chat da plataforma (Gist), Discord, e-mail. Não existe visibilidade consolidada. Consequências reais já mapeadas:

- Mesmo cliente aciona 4+ pessoas simultaneamente sem ninguém saber
- Mais de 50% das demandas são fora do escopo contratado e ninguém quantifica
- Violações de tom profissional passam despercebidas
- Não há SLA mensurável
- Decisões de governança do cliente estão sendo tomadas pela uMode sem formalização

### 1.3 O que NÃO é

- Não é um helpdesk/ticketing system (não substitui Gist, Zendesk etc.)
- Não é CRM (não gerencia pipeline de vendas)
- Não é ferramenta de comunicação (não envia mensagens)
- É um **hub analítico e de auditoria** que CONSOME dados de outros sistemas

### 1.4 Proposta de valor em uma frase

> "Transformar conversas dispersas em inteligência acionável para gestão de CX."

---

## 2. ARQUITETURA TÉCNICA

### 2.1 Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | Lovable (React + Tailwind) | Velocidade de prototipação, UI profissional |
| Backend/DB | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) | Serverless, escala, RLS nativo |
| IA / Classificação | **Google Gemini (gemini-2.5-flash) via Edge Functions, fallback claude-sonnet-4** | Custo-benefício, sem dependência OpenAI |
| Filas / Jobs | Tabela `sync_jobs` (PostgreSQL) + pg_cron | Processamento assíncrono resiliente com estado persistido |
| Storage | Supabase Storage | Arquivos, áudios, anexos |
| Alertas | Supabase Edge Functions → Webhook (WhatsApp via Z-API ou Evolution API) + SMTP (e-mail) | Notificações em tempo real |

> **DECISÃO DEFINITIVA:** O projeto NÃO usa OpenAI. O modelo principal de classificação é **Gemini (gemini-2.5-flash)**. Em caso de falha do Gemini, o fallback é **claude-sonnet-4**. A variável `OPENAI_API_KEY` não existe neste projeto.

### 2.2 Diagrama de Fluxo de Dados

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│    GIST     │  │   DISCORD   │  │  WHATSAPP   │  │   E-MAIL    │  │ TRANSCRIÇÕES │
│  (webhook)  │  │    (bot)    │  │  (webhook)  │  │   (IMAP/    │  │  (upload /   │
│             │  │             │  │             │  │   webhook)  │  │   webhook)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘
       │                │                │                │                │
       └────────────────┴────────────────┴────────────────┴────────────────┘
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │   INGEST EDGE FUNCTION  │
                            │  (normalização + parse) │
                            └────────────┬───────────┘
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │      SUPABASE DB       │
                            │   interactions table   │
                            │  (dados brutos + meta) │
                            └────────────┬───────────┘
                                         │
                                    (pg_cron / trigger)
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │  CLASSIFY EDGE FUNCTION │
                            │  (Gemini 2.5 Flash)    │
                            │  fallback: claude-sonnet│
                            │  - tom                 │
                            │  - tema                │
                            │  - sentimento          │
                            └────────────┬───────────┘
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │   AUDIT EDGE FUNCTION   │
                            │  (verifica thresholds)  │
                            │  → dispara alertas      │
                            └────────────┬───────────┘
                                         │
                                    ┌────┴────┐
                                    ▼         ▼
                              ┌──────────┐ ┌──────────┐
                              │ WhatsApp │ │  E-mail  │
                              │  Alerta  │ │  Alerta  │
                              └──────────┘ └──────────┘
```

### 2.3 Princípios de Arquitetura

1. **Append-only na ingestão.** Mensagens entram e nunca são editadas. Classificações são campos separados atualizados depois.
2. **Classificação assíncrona.** A ingestão NÃO espera a IA. Mensagem entra → salva → fila classifica em batch (a cada 1-5 min).
3. **Idempotência obrigatória.** Toda ingestão usa `external_id` (ID original do canal) como chave de dedup. Reprocessar não duplica.
4. **Row Level Security (RLS).** Cada usuário do hub vê apenas clientes aos quais tem acesso. Admin vê tudo.
5. **Multi-cliente, single-tenant.** Uma instância Supabase, dados segregados por `client_id`. Não é SaaS público.
6. **Jobs persistidos no banco.** Todo processamento longo (sync, ingestão histórica, classificação em lote) usa a tabela `sync_jobs`. O estado sobrevive a navegação, refresh, e falhas. Nunca em estado de componente React.
7. **Batch obrigatório.** Qualquer operação que processe mais de 50 registros ou chame APIs externas deve ser dividida em batches de no máximo 5 páginas por invocação de Edge Function. Limite do Supabase Cloud: ~150s wall-clock.
8. **Retry automático.** Jobs com falha são retentados automaticamente até 3x com backoff. O usuário não precisa agir para retomar.
9. **Auditoria de jobs.** Toda execução de job gera log com: início, fim, registros processados, erros, status. Visível na UI.
10. **Sync incremental obrigatório.** Toda integração com API externa DEVE implementar filtro por data/cursor desde a primeira versão. Nunca re-processar todo o histórico em syncs subsequentes. O job salva `since_timestamp` (último `completed_at`) no payload e o handler para o loop quando encontrar registros mais antigos que esse timestamp. APIs ordenadas por `updated_at DESC` permitem parar antecipadamente sem varrer todas as páginas.
11. **Auto-chain para jobs longos.** Se `has_more=true` ao fim de um batch, a Edge Function deve se auto-invocar via fetch antes de retornar, além de manter o status `pending` para o pg_cron como safety net. Elimina a latência de 2 minutos entre batches em operações longas.

### 2.4 Anti-padrões Proibidos

Os itens abaixo **nunca** devem ser implementados, independente de parecerem mais simples:

| Anti-padrão | Risco Real | Alternativa Obrigatória |
|-------------|-----------|------------------------|
| Loop assíncrono em componente React | Morre ao navegar. Sem retry. Sem log. | Tabela `sync_jobs` + pg_cron |
| Edge Function processando > 300 registros por invocação | Timeout (~150s). Dados corrompidos a meio caminho. | Batch de 5 páginas + `has_more` |
| Estado de progresso em `localStorage` | Perde ao trocar de dispositivo. Não é auditável. | Coluna `progress` em `sync_jobs` |
| Operação destrutiva sem proteção `auto_created` | Deleta clientes reais (By NV, Osklen). | Sempre filtrar por `metadata->>'auto_created' = 'true'` antes de UPDATE/DELETE em massa |
| Ingestão sem `ON CONFLICT DO NOTHING` | Duplica dados ao reprocessar. | `external_id` como chave de dedup sempre |
| Sync sem filtro de data/cursor | Re-processa todo o histórico a cada execução. 295 páginas × 2min = 2h para completar. | `since_timestamp` no payload do job. Parar loop quando `item.updated_at < since_timestamp`. |
| Continuar paginando após item mais antigo que `since_timestamp` | Desperdício de chamadas à API. APIs ordenadas por `updated_at DESC` — itens seguintes são ainda mais antigos. | `break` imediato ao encontrar primeiro item fora do range. |
| Usar OpenAI / referenciar OPENAI_API_KEY | Decisão de produto: projeto não usa OpenAI. | Gemini (gemini-2.5-flash) + fallback claude-sonnet-4. |

---

## 3. MODELO DE DADOS (Supabase / PostgreSQL)

### 3.1 Schema Principal

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE channel_type AS ENUM (
  'gist', 'discord', 'whatsapp', 'email', 'transcription_gemini', 'transcription_tactiq', 'manual'
);

CREATE TYPE interaction_type AS ENUM (
  'text', 'audio', 'image', 'file', 'system'
);

CREATE TYPE tone_severity AS ENUM (
  'ok', 'atencao', 'alerta', 'critico'
);

CREATE TYPE alert_channel AS ENUM (
  'email', 'whatsapp', 'both'
);

-- ============================================================
-- TABELAS CORE
-- ============================================================

-- Clientes da uMode (By NV, Farm, etc.)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- ex: 'bynv', 'farm'
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- escopo contratado, SLA, last_seen_at, auto_created, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mapeamento: qual canal pertence a qual cliente
CREATE TABLE channel_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) NOT NULL,
  channel channel_type NOT NULL,
  channel_identifier TEXT NOT NULL, -- ex: discord_channel_id, whatsapp_group_id, email domain
  label TEXT, -- nome legível: "WA Vanessa x Vinicius"
  active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- configs específicas do canal
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel, channel_identifier)
);

-- Participantes conhecidos (pessoas que interagem)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  name TEXT NOT NULL,
  role TEXT, -- 'client_focal', 'client_director', 'umode_ka', 'umode_support'
  side TEXT NOT NULL CHECK (side IN ('client', 'umode', 'unknown')),
  identifiers JSONB DEFAULT '[]', -- [{"channel": "whatsapp", "value": "+5511..."}]
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABELA PRINCIPAL: INTERAÇÕES
-- ============================================================

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Origem
  client_id UUID REFERENCES clients(id) NOT NULL,
  channel channel_type NOT NULL,
  channel_binding_id UUID REFERENCES channel_bindings(id),
  external_id TEXT, -- ID original no sistema de origem (dedup)
  
  -- Conteúdo
  content TEXT, -- texto da mensagem (ou transcrição do áudio)
  interaction_type interaction_type DEFAULT 'text',
  raw_payload JSONB, -- payload original completo (preservar sempre)
  
  -- Participantes
  sender_participant_id UUID REFERENCES participants(id),
  sender_raw TEXT, -- nome/número como veio do canal (fallback)
  sender_side TEXT CHECK (sender_side IN ('client', 'umode', 'unknown')),
  
  -- Temporal
  occurred_at TIMESTAMPTZ NOT NULL, -- quando a mensagem foi enviada originalmente
  ingested_at TIMESTAMPTZ DEFAULT now(), -- quando entrou no hub
  
  -- Classificação IA (preenchido assíncrono)
  tone tone_severity DEFAULT 'ok',
  tone_detail TEXT, -- explicação curta da classificação
  theme TEXT, -- tema classificado: 'integracao_erp', 'permissoes', etc.
  theme_detail TEXT, -- subtema ou descrição
  sentiment FLOAT, -- -1.0 a 1.0
  is_out_of_scope BOOLEAN,
  classification_model TEXT, -- ex: 'gemini-2.5-flash' ou 'claude-sonnet-4'
  classified_at TIMESTAMPTZ,
  
  -- Anexos
  attachments JSONB DEFAULT '[]', -- [{url, type, filename, size}]
  
  -- Índices de busca
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content, ''))) STORED,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dedup index
CREATE UNIQUE INDEX idx_interactions_dedup ON interactions(channel, external_id) WHERE external_id IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_interactions_client ON interactions(client_id, occurred_at DESC);
CREATE INDEX idx_interactions_tone ON interactions(client_id, tone) WHERE tone != 'ok';
CREATE INDEX idx_interactions_theme ON interactions(client_id, theme);
CREATE INDEX idx_interactions_search ON interactions USING GIN(search_vector);
CREATE INDEX idx_interactions_unclassified ON interactions(ingested_at) WHERE classified_at IS NULL;

-- ============================================================
-- FILA DE JOBS (obrigatório para toda operação longa)
-- ============================================================

CREATE TYPE job_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TYPE job_type AS ENUM (
  'sync_contacts', 'ingest_historical', 'classify_batch', 'transcribe_audio'
);

CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type job_type NOT NULL,
  status job_status DEFAULT 'pending',
  
  -- Escopo
  client_id UUID REFERENCES clients(id), -- NULL = todos os clientes
  
  -- Configuração do job
  payload JSONB DEFAULT '{}', -- parâmetros de entrada (ex: {max_pages: 5, channel: 'gist'})
  
  -- Estado de progresso (atualizado a cada batch)
  progress JSONB DEFAULT '{}',
  -- ex: {current_page: 12, total_pages: 31, records_processed: 720,
  --      records_created: 155, records_skipped: 565, errors: []}
  
  -- Retry
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  
  -- Temporal
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sync_jobs_status ON sync_jobs(status, created_at DESC);
CREATE INDEX idx_sync_jobs_client ON sync_jobs(client_id, created_at DESC);

-- ============================================================
-- AUDITORIAS E ALERTAS
-- ============================================================

-- Regras de auditoria configuráveis
CREATE TABLE audit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id), -- NULL = aplica a todos
  active BOOLEAN DEFAULT true,
  
  metric TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>=', '<=', '>', '<', '==', 'change_pct_up', 'change_pct_down')),
  threshold FLOAT NOT NULL,
  window_hours INT DEFAULT 24,
  
  alert_channel alert_channel DEFAULT 'email',
  alert_recipients JSONB NOT NULL,
  cooldown_hours INT DEFAULT 24,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Log de alertas disparados
CREATE TABLE audit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES audit_rules(id) NOT NULL,
  client_id UUID REFERENCES clients(id),
  metric_value FLOAT NOT NULL,
  threshold FLOAT NOT NULL,
  message TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CONTROLE DE ACESSO
-- ============================================================

CREATE TABLE user_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'analyst', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY interactions_access ON interactions FOR SELECT USING (
  client_id IN (SELECT client_id FROM user_client_access WHERE user_id = auth.uid())
);

CREATE POLICY clients_access ON clients FOR SELECT USING (
  id IN (SELECT client_id FROM user_client_access WHERE user_id = auth.uid())
);

CREATE POLICY sync_jobs_access ON sync_jobs FOR SELECT USING (
  created_by = auth.uid()
  OR client_id IN (SELECT client_id FROM user_client_access WHERE user_id = auth.uid())
);
```

### 3.2 Metadados de Clientes (campos em `clients.metadata`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `auto_created` | boolean | `true` se criado automaticamente pelo sync. Clientes reais (By NV, Osklen) NÃO têm esse campo. |
| `source` | string | `"gist_sync"` para clientes criados pelo sync |
| `last_seen_at` | ISO string | Último acesso à plataforma (via Gist `last_seen_at`) |
| `scope` | string | Escopo contratado (editável na UI) |
| `sla` | object | `{hours_start, hours_end, response_time_minutes, working_days}` |
| `monitored_themes` | string[] | Temas monitorados ativamente |
| `governance_rules` | object[] | Regras de governança configuradas |
| `documents` | object[] | Documentos anexados |

> **REGRA CRÍTICA:** Operações destrutivas em massa (UPDATE/DELETE) SEMPRE devem filtrar por `metadata->>'auto_created' = 'true'` para proteger clientes reais.

### 3.3 Temas Padronizados (enum semântico)

| Slug | Nome | Descrição |
|------|------|-----------|
| `integracao_erp` | Integração / ERP / Linx | Preço, status, forçamento, fornecedor pós-OP |
| `agendamento` | Agendamento / Reuniões | Weeklys, convites, disponibilidade |
| `permissoes` | Permissões / Perfis | Criação perfis, trava campos, acessos |
| `cobranca_followup` | Cobranças / Follow-ups | Pedidos de retorno, cobranças de prazo |
| `gestao_demandas` | Gestão de Demandas | Orçamento, reonboarding, macroplan |
| `workflow` | Workflow / Processos | Fluxos operacionais, deslacre, automação |
| `importacao_dados` | Importação / Dados | JSON, planilhas, templates, migração |
| `intermediacao` | Intermediação Áreas | uMode articulando áreas internas do cliente |
| `bugs` | Bugs / Erros Técnicos | Instabilidade, comportamento inesperado |
| `criacao_campos` | Criação de Campos | Novos campos, configurações |
| `treinamento` | Treinamento | Capacitação, orientação de uso |
| `elogio` | Elogios / Feedback Positivo | Agradecimentos, ratings positivos |
| `governanca` | Governança Operacional | Decisões de processo que cabem ao cliente |
| `outro` | Outros | Temas que não se encaixam (revisar periodicamente) |

---

## 4. PADRÃO DE JOBS — OBRIGATÓRIO PARA TODA OPERAÇÃO LONGA

### 4.1 Quando usar sync_jobs

**Obrigatório** para qualquer operação que:
- Processa mais de 50 registros
- Chama APIs externas (Gist, Gemini, WhatsApp, etc.)
- Pode levar mais de 10 segundos
- Precisa de retry em caso de falha
- O usuário precisa ver progresso

### 4.2 Fluxo padrão de um job

```
UI cria registro em sync_jobs (status='pending')
  → pg_cron detecta job pendente (a cada 2 min)
  → Edge Function "process-jobs":
      → SELECT job WHERE status='pending' FOR UPDATE SKIP LOCKED
      → UPDATE status='running', started_at=now()
      → Processa batch (max 5 páginas / 300 registros)
      → UPDATE progress={current_page, total, processed, errors}
      → Se has_more: status='pending' (pg_cron pega na próxima rodada)
      → Se completo: status='completed', completed_at=now()
      → Se erro e retry_count < max_retries: status='pending', retry_count++
      → Se erro e retry_count >= max_retries: status='failed'
  → UI observa via Supabase Realtime (subscribe na tabela sync_jobs)
  → Progresso atualiza em tempo real sem polling
```

### 4.3 Exibição na UI

A aba "Sincronização" em Configurações deve exibir:
- Jobs ativos (status='running') com barra de progresso em tempo real
- Jobs na fila (status='pending') com posição
- Histórico dos últimos 20 jobs concluídos/falhados
- Botão "Retentar" para jobs falhados
- Botão "Cancelar" para jobs pendentes/rodando

---

## 5. INTEGRAÇÕES — INGESTÃO DE DADOS

> **PRÉ-REQUISITO:** Antes de implementar qualquer nova integração, o padrão de jobs (seção 4) deve estar implementado. Toda ingestão histórica usa `sync_jobs`. Webhooks em tempo real são a exceção — eles são síncronos por natureza.

### 5.1 Gist (Chat da Plataforma)

**Método:** Webhook do Gist → Edge Function `ingest-gist`

**Edge Function `sync-gist-contacts`** (já implementada):
- Sincroniza participantes e `last_seen_at` via API do Gist
- Roda automaticamente via pg_cron a cada 6 horas
- Batch de 5 páginas por invocação (60 contatos/página)
- `auto_created: true` em todos os clientes criados automaticamente

**Edge Function `ingest-gist-historical`** (já implementada):
- Importa histórico de conversas do Gist
- Batch de 5 páginas por invocação
- `ON CONFLICT DO NOTHING` para idempotência

### 5.2 Discord, WhatsApp, E-mail, Transcrições

Ver seções originais do PRD. **Todas devem usar `sync_jobs` para ingestão histórica.**

---

## 6. CLASSIFICAÇÃO POR IA

### 6.1 Arquitetura do Pipeline

```
pg_cron (a cada 2 min)
  → Edge Function "classify-batch"
    → SELECT * FROM interactions WHERE classified_at IS NULL ORDER BY ingested_at LIMIT 50
    → Agrupa em chunks de 10 mensagens
    → Para cada chunk: POST Gemini API (gemini-2.5-flash) com prompt de classificação
    → Se Gemini falhar: fallback para claude-sonnet-4
    → UPDATE interactions SET tone, theme, sentiment, classified_at, classification_model
    → Se alguma classificação = 'alerta' ou 'critico': chama "check-audit-rules"
```

> **NUNCA usar OpenAI neste pipeline.** Modelo principal: `gemini-2.5-flash`. Fallback: `claude-sonnet-4`.

### 6.2 Prompt de Classificação (System Prompt)

```
Você é um classificador de interações de atendimento B2B de tecnologia.

CONTEXTO: Você receberá mensagens trocadas entre um cliente (empresa) e um fornecedor de software (uMode). Sua tarefa é classificar cada mensagem em três dimensões.

DIMENSÃO 1 — TOM (tone)
- "ok": Tom profissional, neutro ou positivo.
- "atencao": Tom impaciente, cobranças ríspidas, linguagem imperativa sem contexto.
- "alerta": Agressividade passiva, ultimatos, desqualificação, ameaça de escalar/abandonar.
- "critico": Ofensas diretas, ameaças, linguagem abusiva.
Classifique AMBOS os lados igualmente.

DIMENSÃO 2 — TEMA (theme) — use exatamente um slug:
integracao_erp | agendamento | permissoes | cobranca_followup | gestao_demandas |
workflow | importacao_dados | intermediacao | bugs | criacao_campos |
treinamento | elogio | governanca | outro

DIMENSÃO 3 — SENTIMENTO (sentiment): -1.0 a 1.0

FORMATO (JSON estrito, sem markdown):
[{"id":"<id>","tone":"...","tone_detail":"...","theme":"...","theme_detail":"...","sentiment":<float>}]

REGRAS:
- Mensagens curtas/ambíguas ("ok","👍"): tone=ok, theme=outro, sentiment=0.0
- Pressão hierárquica (mencionar diretor, escalar): tone >= alerta
- Mensagens de sistema/bot: tone=ok, theme=outro
```

### 6.3 Custo Estimado

- Gemini 2.5 Flash: custo muito baixo por token
- claude-sonnet-4: fallback, uso ocasional
- 5.000 msgs/dia → custo estimado bem abaixo de R$1,00/dia

---

## 7. SISTEMA DE AUDITORIAS E ALERTAS

### 7.1 Métricas Monitoráveis

| Métrica | Cálculo | Exemplo |
|---------|---------|---------|
| `tone_critico_count` | COUNT tone='critico' na janela | >= 1 em 24h → alerta imediato |
| `tone_alerta_count` | COUNT tone='alerta' na janela | >= 3 em 24h → alerta |
| `tone_atencao_count` | COUNT tone='atencao' na janela | >= 10 em 24h → alerta |
| `out_of_scope_pct` | % is_out_of_scope=true na janela | >= 60% em 7d → alerta |
| `volume_daily` | COUNT total na janela | >= 200 em 24h → sobrecarga |
| `after_hours_count` | COUNT fora do horário | >= 5 em 24h → alerta |
| `response_time_avg` | Média tempo cliente→uMode | >= 120min em 24h → alerta |

### 7.2 Regras Padrão (Seed Data)

```sql
INSERT INTO audit_rules (name, metric, operator, threshold, window_hours, alert_channel, alert_recipients, cooldown_hours) VALUES
('Tom Crítico Detectado', 'tone_critico_count', '>=', 1, 24, 'both', '[{"type":"email","value":"boss@umode.com"},{"type":"whatsapp","value":"+5511999999999"}]', 1),
('Pico de Alertas de Tom', 'tone_alerta_count', '>=', 3, 24, 'email', '[{"type":"email","value":"boss@umode.com"}]', 24),
('Sobrecarga de Volume', 'volume_daily', '>=', 200, 24, 'email', '[{"type":"email","value":"cs@umode.com"}]', 24),
('Excesso Fora de Escopo', 'out_of_scope_pct', '>=', 50, 168, 'email', '[{"type":"email","value":"boss@umode.com"}]', 168),
('Mensagens Fora de Horário', 'after_hours_count', '>=', 5, 24, 'whatsapp', '[{"type":"whatsapp","value":"+5511999999999"}]', 24);
```

---

## 8. FRONTEND — TELAS DO HUB

### 8.1 Status atual de implementação

| Tela | Status |
|------|--------|
| Login / Auth | ✅ Implementado |
| Sidebar + Layout | ✅ Implementado |
| ClientsPage (tabela com termômetro) | ✅ Implementado |
| ClientDetailPage (6 tabs) | ✅ Implementado |
| Configurações → Integrações | ✅ Implementado |
| Configurações → Sincronização | ✅ Implementado (migrado para sync_jobs) |
| InteractionsPage (feed) | 🔄 Parcial |
| Dashboard | ⏳ Pendente |
| Auditorias | ⏳ Pendente |

### 8.2 Dashboard Principal

- Header com cliente selecionado + seletor de período
- 6 KPI cards: total interações, mensagens hoje, alertas/críticos, % fora de escopo, tempo médio resposta, fora de horário
- Gráfico de linha: volume 30 dias
- Gráfico de barras empilhadas: distribuição por tema
- Heatmap: volume por hora × dia da semana
- Tabela: últimas 5 ocorrências de tom != 'ok'

### 8.3 Feed de Interações

- Filtros: canal, tom, tema, lado, período, busca por texto
- Timeline com ícone de canal, badge de lado (uMode/Cliente), conteúdo truncado, badges de tom e tema
- Paginação infinita
- Painel lateral ao clicar: detalhes + raw_payload + botão "Reclassificar"

### 8.4 Clientes

- Tabela com termômetro de saúde → `/clients/:slug`
- Página de detalhe com 6 tabs: Visão Geral, Participantes, Canais, Documentos, Regras de Negócio, Configurações
- Tab "Tasks 🔒" reservada — toast "Em breve"

### 8.5 Auditorias

- Aba "Regras": CRUD de audit_rules
- Aba "Histórico": log de audit_alerts com status de entrega

---

## 9. SEQUÊNCIA DE IMPLEMENTAÇÃO (FASES)

### Fase 0 — Fundação ✅ Concluída
Schema SQL, Auth, Layout base, Sidebar

### Fase 1 — Dados Reais ✅ Concluída
sync-gist-contacts, ingest-gist-historical, UI de Clientes

### Fase 2 — Job Queue ✅ Concluída
1. ✅ Tabela `sync_jobs` criada
2. ✅ Edge Function `process-jobs` deployada
3. ✅ `sync-gist-contacts` e `ingest-gist-historical` migradas para sync_jobs
4. ✅ pg_cron configurado para `process-jobs` a cada 2 min
5. ✅ UI de Sincronização usando Realtime na tabela sync_jobs
6. ✅ Loop de polling no frontend descartado

### Fase 3 — Classificação IA ✅ Em execução
1. ✅ Edge Function `classify-batch` (Gemini 2.5 Flash + fallback claude-sonnet-4)
2. ✅ pg_cron a cada 2 min
3. ⏳ Validar qualidade das classificações com dados reais By NV
4. ⏳ Dashboard com dados classificados

### Fase 4 — Feed de Interações
1. InteractionsPage completa com filtros
2. Painel lateral de detalhe
3. Botão "Reclassificar"

### Fase 5 — Auditorias e Alertas
1. Edge Function `check-audit-rules`
2. Configurar SMTP + WhatsApp para alertas
3. UI de Auditorias (Regras + Histórico)

### Fase 6 — Novas Integrações (apenas após Fase 2)
WhatsApp, E-mail, Discord — todos usando sync_jobs

### Fase 7 — Polimento
Relatórios exportáveis, temas emergentes, transcrição Whisper, Tasks (integração Notion ou módulo nativo)

---

## 10. DECISÕES DE PRODUTO IMPORTANTES

### 10.1 O que deliberadamente NÃO entra no MVP

| Feature | Motivo | Quando considerar |
|---------|--------|-------------------|
| Responder ao cliente pelo hub | Hub é read-only por design | Nunca |
| Detecção de fora-de-escopo por IA | Requer contexto do contrato | Fase 7 |
| OpenAI / GPT | Decisão de produto — usar Gemini + Claude | Nunca |
| Multi-tenant / SaaS público | Prematuridade | Só se virar produto comercializado |
| App mobile | Time usa no desktop | Quando houver demanda |
| Integrações bidirecionais | Hub só lê, não escreve nos canais | Nunca |
| Gestão de Tasks nativa | Escopo diferente — reservar slot "Em breve" | Fase 7+ após validação |

### 10.2 Riscos Técnicos

| Risco | Mitigação |
|-------|-----------|
| Edge Function timeout | Batch de 5 páginas + sync_jobs com retry |
| Navegação mata o processo | sync_jobs persiste no banco, independe do frontend |
| Rate limit Gemini | Batch de 10, retry com backoff, fallback claude-sonnet-4 |
| Classificação errada da IA | Botão "Reclassificar" na UI |
| Operação destrutiva em clientes reais | Filtro `auto_created = 'true'` obrigatório |
| RLS performance em queries pesadas | Views materializadas se necessário |

---

## 11. CHECKLIST PRÉ-IMPLEMENTAÇÃO

Antes de gerar qualquer prompt de Edge Function ou integração, verificar:

- [ ] Essa operação processa mais de 50 registros? → Usar sync_jobs
- [ ] Essa operação chama uma API externa? → Usar sync_jobs + retry
- [ ] Essa operação pode levar mais de 10s? → Usar sync_jobs
- [ ] Tem `ON CONFLICT DO NOTHING` ou dedup por `external_id`?
- [ ] Operações de UPDATE/DELETE em massa filtram por `auto_created`?
- [ ] O progresso fica no banco, não em estado React?
- [ ] Existe log auditável do que foi processado?
- [ ] **O que acontece na SEGUNDA execução?** Sync incremental implementado com `since_timestamp`?
- [ ] **Qual o volume máximo por execução?** Calculado e dentro do limite de 150s?
- [ ] **O loop para ao encontrar item fora do range de data?** `break` imediato, não `continue`.
- [ ] **Auto-chain implementado?** Se `has_more=true`, auto-invocar antes de retornar.
- [ ] Todo SQL de schema foi **validado** antes de executar no Supabase?
- [ ] **Está usando Gemini (gemini-2.5-flash)?** Nunca OpenAI. Fallback: claude-sonnet-4.

---

## 12. DOCUMENTAÇÕES DE API NECESSÁRIAS

| Integração | O que precisa | Onde achar |
|------------|---------------|------------|
| **Gist** | Webhook API, payload, auth | Dashboard Gist → Settings → Webhooks |
| **Discord** | Bot setup, MESSAGE_CREATE, gateway intents | https://discord.com/developers/docs |
| **WhatsApp (Z-API)** | Webhook config, message payload, media | https://developer.z-api.io |
| **WhatsApp (Evolution)** | Webhook events, message structure, auth | Docs da instância Evolution |
| **SendGrid Inbound Parse** | Webhook setup, multipart payload | https://docs.sendgrid.com/for-developers/parsing-email |
| **Gemini API** | generateContent, modelos, pricing | https://ai.google.dev/api |
| **Gemini/Meet** | Export format | Google Workspace docs |
| **Tactiq** | Export format CSV/JSON | https://tactiq.io |

---

## 13. VARIÁVEIS DE AMBIENTE (Supabase)

```
# Supabase (auto-configuradas)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# IA — Gemini principal, Claude fallback (SEM OpenAI)
GEMINI_API_KEY=
# claude-sonnet-4 usa a chave da Anthropic via SDK interno do Supabase

# Webhooks de Ingestão
GIST_API_KEY=
GIST_WEBHOOK_SECRET=
DISCORD_INGEST_TOKEN=
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=

# E-mail (SMTP para alertas)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# WhatsApp para Alertas
WHATSAPP_ALERT_API_URL=
WHATSAPP_ALERT_API_TOKEN=
WHATSAPP_ALERT_FROM=
```

---

## 14. COMANDOS LOVABLE — QUICK REFERENCE

Ao iniciar uma sessão no Lovable, cole:

> "Estou construindo o CX Hub. Stack: Lovable + Supabase. O schema SQL já está criado no Supabase. Vou te pedir para criar componentes e Edge Functions um de cada vez. Para cada pedido: (1) crie o componente/função completo e funcional, (2) use TypeScript, (3) conecte ao Supabase usando o client já configurado no projeto, (4) respeite o schema da tabela interactions, (5) toda query filtre por client_id, (6) operações longas usam a tabela sync_jobs — nunca loops em componentes React, (7) toda ingestão tem ON CONFLICT DO NOTHING, (8) operações destrutivas em massa filtram por metadata->>'auto_created' = 'true', (9) todo sync com API externa é incremental — salva since_timestamp no payload e para o loop ao encontrar item mais antigo que esse timestamp, (10) se has_more=true ao fim do batch, auto-invocar a Edge Function antes de retornar, (11) classificação usa SEMPRE Gemini (gemini-2.5-flash) com fallback claude-sonnet-4 — NUNCA OpenAI."

---

*Documento v2.2 — 07/03/2026.*
*v1.0 gerado em 04/03/2026. Baseado na análise real de 1.400+ interações By NV × uMode (Nov/2025 – Mar/2026).*
*v2.0: adicionados princípios de jobs persistidos, anti-padrões proibidos, checklist pré-implementação, tabela sync_jobs, status de implementação por fase.*
*v2.1: adicionados princípios 10 e 11 (sync incremental obrigatório, auto-chain), dois novos anti-padrões, checklist expandido. Origem: bug real de re-processamento de 295 páginas a cada sync.*
*v2.2: substituído OpenAI/GPT-4o-mini por Gemini (gemini-2.5-flash) + fallback claude-sonnet-4 como decisão definitiva de stack de IA. Fases 2 e 3 atualizadas para refletir estado atual de implementação.*
