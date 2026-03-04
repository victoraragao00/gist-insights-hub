

# Hub de Integrações — Plataforma Multi-App

A arquitetura atual está orientada ao Gist como produto único. Precisa ser reestruturada para um **hub genérico** onde o usuário conecta qualquer plataforma, cria indicadores customizados e configura alertas automáticos.

## Nova Arquitetura

```text
┌──────────────────────────────────────────────────┐
│                   HUB CENTRAL                    │
├──────────┬───────────┬───────────┬───────────────┤
│ Conexões │ Dashboard │ Indicadores│  Auditorias  │
│ (Apps)   │ (Visão)   │ (Builder)  │  (Alertas)   │
├──────────┴───────────┴───────────┴───────────────┤
│              Edge Functions (Proxy)              │
│  gist-proxy │ stripe-proxy │ generic-api-proxy   │
├──────────────────────────────────────────────────┤
│           Database (integrations, kpis,          │
│           alert_rules, alert_logs)               │
└──────────────────────────────────────────────────┘
```

## Fase 1 — Banco de Dados e Modelo de Integrações

Criar tabelas:
- **integrations**: id, user_id, platform (gist/stripe/linear/notion/whatsapp/custom), name, auth_type (api_key/oauth/token), credentials (encrypted), config (JSON com endpoints habilitados), status (active/inactive), created_at
- **data_sources**: id, integration_id, endpoint_path, label, data_schema (JSON), sync_interval, last_synced_at
- **kpi_indicators**: id, user_id, name, data_source_id, metric_type (count/sum/avg/percentage/custom), formula (expressão customizada), filters (JSON), chart_type (line/bar/donut/number), created_at
- **alert_rules**: id, user_id, kpi_indicator_id, condition_type (threshold/percentage_change/compound), conditions (JSON com regras compostas), notification_channels (JSON: whatsapp/email/slack/push), is_active, cooldown_minutes
- **alert_logs**: id, alert_rule_id, triggered_at, value_at_trigger, notification_sent_to

RLS policies por user_id em todas as tabelas.

## Fase 2 — Marketplace de Integrações

Reestruturar a navegação:
- **Sidebar**: Dashboard, Integrações, Indicadores, Auditorias, Insights IA, Configurações
- Remover páginas Conversas/Contatos/Campanhas (eram específicas do Gist)

Nova página **Integrações** (/integrations):
- Grid de cards com plataformas disponíveis (Gist, Stripe, Linear, Notion, TUDO1, WhatsApp, Slack, Custom API)
- Cada card mostra: logo, nome, status (conectado/desconectado), botão conectar
- Ao conectar: modal pede API Key/Token (ou inicia OAuth quando disponível)
- Após conectar: lista de data sources disponíveis para aquela plataforma com toggles

Edge Function **generic-api-proxy**:
- Recebe integration_id + endpoint, busca credenciais do banco, faz a chamada e retorna dados
- Suporta diferentes auth types (Bearer, API Key header, query param)

## Fase 3 — Builder de Indicadores

Nova página **Indicadores** (/indicators):
- Lista de KPIs criados pelo usuário em cards
- Botão "Novo Indicador" abre builder visual:
  1. Selecionar fonte de dados (integração + endpoint)
  2. Escolher métrica (contagem, soma, média, % de variação)
  3. Aplicar filtros (campo, operador, valor)
  4. Escolher tipo de visualização (número grande, linha, barra, donut)
  5. Nomear e salvar

Templates prontos por plataforma:
- Gist: "Conversas abertas", "Total de contatos", "Campanhas ativas"
- Stripe: "MRR", "Churn rate", "Novos assinantes"
- Linear: "Issues abertas", "Cycle velocity"
- Ao selecionar template, preenche automaticamente o builder

Dashboard principal mostra os indicadores criados em grid editável.

## Fase 4 — Sistema de Auditorias e Alertas

Nova página **Auditorias** (/audits):
- Lista de regras de alerta ativas/inativas
- Botão "Nova Auditoria" abre wizard:
  1. Selecionar indicador(es) a monitorar
  2. Definir condição: simples ("se > 50") ou composta ("se X caiu 20% E Y > 30")
  3. Selecionar canais de notificação (WhatsApp, Email, Slack, Push)
  4. Definir cooldown (evitar spam de alertas)
  5. Ativar

Edge Function **check-alerts** (executada via cron a cada 5min):
- Percorre regras ativas, puxa dados atuais via proxy, avalia condições
- Se trigger: envia notificação nos canais configurados e registra no alert_logs

Edge Function **send-notification**:
- Envia via WhatsApp (API), Email, Slack (connector) conforme canal

## Fase 5 — Insights IA com Gemini

- Mantém a página Insights mas agora analisa dados de TODAS as integrações conectadas
- Botão "Gerar Análise" envia KPIs atuais ao Gemini (externo, via secret GEMINI_API_KEY)
- Chat para perguntas sobre dados cross-platform

## Fase 6 — Refinamentos

- Filtros de período globais
- Skeletons e estados de erro
- Responsividade
- Logs de sincronização por integração

## Secrets Necessários

- **GIST_API_KEY**: quando usuário conectar Gist
- **GEMINI_API_KEY**: para insights IA
- Demais keys: armazenadas criptografadas no banco por integração

## Ordem de Implementação

1. Banco de dados (tabelas + RLS)
2. Reestruturar sidebar e rotas
3. Página de Integrações (marketplace + modal de conexão)
4. Edge Function generic-api-proxy
5. Builder de Indicadores + templates
6. Dashboard dinâmico com KPIs do usuário
7. Sistema de Auditorias (regras + cron + notificações)
8. Insights IA cross-platform

