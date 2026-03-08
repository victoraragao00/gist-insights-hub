# Plano Executivo v2 — CX Hub UX/UI
# Revisao apos 4 apontamentos do Projeto
# Data: 2026-03-08

---

## APONTAMENTO 1 — PR-A dividido

Criterio de corte: funcional (erros que afetam usuario) vs visual (consistencia estetica).

### PR-A1: Correcoes de estado de erro (funcional — ALTA)

Titulo: fix: error states in ClientsPage and ClientDetailPage

Itens:
- ClientsPage: isError → Alert destrutivo + "Tentar novamente" (refetch)
- ClientDetailPage: isError → Alert + retry; !client && !isError → "Cliente nao encontrado"

Arquivos: ClientsPage.tsx, ClientDetailPage.tsx (apenas logica de erro)
Checklist: m3 (sonner no retry se aplicavel), m8 (erros tratados), m11

Criterios de aceitacao:
- ClientsPage com isError: Alert + retry visivel, nao confunde erro com vazio
- ClientDetailPage com isError: Alert + retry; sem isError e sem client: 404
- Zero regressao visual

---

### PR-A2: Dark mode, shimmer e padding (visual — MEDIA)

Titulo: fix: dark mode tone/status colors, shimmer skeletons, layout padding

Itens:
- TONE_CONFIG dark mode em ClientsPage e ClientDetailPage (Design System 1.1)
- Padding DashboardLayout: p-4 md:p-6 (Design System 5)
- animate-shimmer nos Skeletons de ClientsPage e ClientDetailPage

Excluido:
- jobStatusBadge dark mode em SettingsPage → movido para PR-F (ver Apontamento 4)

Arquivos: ClientsPage.tsx, ClientDetailPage.tsx, DashboardLayout.tsx
Checklist: m11

Criterios de aceitacao:
- Todas as cores de tom com variante dark: conforme Design System 1.1
- DashboardLayout main: p-4 md:p-6
- Skeletons com animate-shimmer
- SettingsPage NAO tocado neste PR

---

## APONTAMENTO 2 — PR-H dividido

### PR-H1: Dashboard filtros e busca (independente — MEDIA)

Titulo: feat: Dashboard search by name and filter by tier

Itens:
- Input de busca por nome do cliente (filter client-side)
- Botoes/select de filtro por tier (Todos, azzas, enterprise, medium, small)
- Contagem atualiza ao filtrar

Sem dependencia de backend. Dados ja disponiveis em usePriorityScores.

Arquivos: Index.tsx
Checklist: m1, m5 (queryKey se filtro via query), m11

Criterios de aceitacao:
- Busca por nome filtra lista em tempo real
- Filtro por tier funciona (Todos = sem filtro)
- Contagem de resultados atualiza
- Limpar filtros volta ao estado original

---

### PR-H2: Dashboard KPI cards globais + graficos de evolucao (depende de Issue #34)

Titulo: feat: Dashboard global KPIs and trend charts

Itens:
- KPI cards: total interacoes 30d, % critico, % alerta, clientes monitorados
- Grafico evolucao de tom por mes (stacked BarChart, ultimos 6 meses)
- Grafico top 5 temas (bar horizontal)
- Grafico distribuicao de score por faixa (BarChart)
- Grafico distribuicao por tier (donut)

Nota: graficos de score/tier NAO dependem de Issue #34 (dados em usePriorityScores).
Apenas KPI cards + evolucao + temas dependem de global_stats_30d.

Opcao: subdividir ainda mais — graficos de score/tier com PR-H1, KPIs com PR-H2.
Decisao do Operador.

Arquivos: Index.tsx, novos componentes de grafico
Checklist: m1, m4, m5, m8, m11

Criterios de aceitacao:
- KPI cards com dados de global_stats_30d
- Graficos usam ChartContainer para tema automatico
- Dark mode correto
- Tooltip interativo

---

## APONTAMENTO 3 — Issue #35 detalhada

### Issue #35: Edge function evaluate-audit-rules

Titulo: feat: evaluate-audit-rules — automated alert detection after priority score calculation

---

#### Schema existente (referencia)

audit_rules:
  id (uuid PK), name (text), description (text?), metric (text),
  operator (text: '>', '<', '>=', '<=', '='), threshold (float),
  window_hours (int?), cooldown_hours (int?), client_id (uuid? FK clients),
  alert_channel (enum: 'email'|'whatsapp'|'both'), alert_recipients (jsonb),
  active (boolean), created_at (timestamptz)

audit_alerts:
  id (uuid PK), rule_id (uuid FK audit_rules), client_id (uuid? FK clients),
  metric_value (float), threshold (float), message (text),
  delivery_status (text: 'pending'|'delivered'|'failed'),
  delivered_at (timestamptz?), created_at (timestamptz)

---

#### Metricas suportadas (como calcular cada uma)

| Metrica | Calculo | Query |
|---------|---------|-------|
| score_prioridade | priority_scores.score do client_id da regra | SELECT score FROM priority_scores WHERE client_id = rule.client_id |
| tom_critico_pct | % de interacoes com tone='critico' nos ultimos window_hours | SELECT count(*) FILTER (WHERE tone='critico') * 100.0 / NULLIF(count(*), 0) FROM interactions WHERE client_id = rule.client_id AND occurred_at >= now() - interval '{window_hours} hours' AND classified_at IS NOT NULL |
| tom_alerta_pct | % de interacoes com tone='alerta' nos ultimos window_hours | Igual acima com tone='alerta' |
| volume_periodo | Total de interacoes nos ultimos window_hours | SELECT count(*) FROM interactions WHERE client_id = rule.client_id AND occurred_at >= now() - interval '{window_hours} hours' |

Extensivel: novas metricas adicionadas como novo case no switch, sem mudar estrutura.

---

#### Pseudocodigo do fluxo principal

```
evaluate-audit-rules(req):
  1. Auth: aceitar apenas service_role_key (nunca JWT manual)
     Se token != service_role_key → return 401

  2. fetchActiveRules(supaAdmin, offset, batchSize):
     SELECT * FROM audit_rules WHERE active = true
     ORDER BY id
     RANGE(offset, offset + batchSize - 1)
     return { rules, hasMore }

  3. Para cada rule em rules:
     a. calculateMetric(supaAdmin, rule):
        switch(rule.metric):
          case 'score_prioridade':
            query priority_scores WHERE client_id = rule.client_id
            return score
          case 'tom_critico_pct':
            query interactions com filtro tone + window_hours
            return percentual
          case 'tom_alerta_pct':
            idem com tone='alerta'
          case 'volume_periodo':
            query count interactions com window_hours
            return count
          default:
            log warning, skip rule
            continue

     b. evaluateRule(metricValue, rule.operator, rule.threshold):
        switch(rule.operator):
          case '>':  return metricValue > threshold
          case '>=': return metricValue >= threshold
          case '<':  return metricValue < threshold
          case '<=': return metricValue <= threshold
          case '=':  return metricValue === threshold
        return false (operador desconhecido)

     c. Se evaluateRule retorna false → skip (regra nao violada)

     d. checkCooldown(supaAdmin, rule.id, rule.cooldown_hours):
        SELECT created_at FROM audit_alerts
        WHERE rule_id = rule.id
        ORDER BY created_at DESC LIMIT 1
        Se ultimo_alerta existe E (now - ultimo_alerta) < cooldown_hours:
          return true (em cooldown, nao disparar)
        return false (pode disparar)

     e. Se em cooldown → skip

     f. insertAlert(supaAdmin, rule, metricValue):
        INSERT INTO audit_alerts {
          rule_id: rule.id,
          client_id: rule.client_id,
          metric_value: metricValue,
          threshold: rule.threshold,
          message: "Regra '{rule.name}' violada: {rule.metric} = {metricValue} ({rule.operator} {threshold})",
          delivery_status: 'pending'
        }

  4. Se hasMore → handleAutoChain (fire-and-forget, mesmo padrao de calculate-priority-scores)

  5. Return { evaluated: count, alerts_created: alertCount, hasMore }
```

---

#### Trigger exato

Em process-jobs/index.ts, APOS o trigger de calculate-priority-scores (ja existente em L1186-1198),
adicionar segundo fire-and-forget para evaluate-audit-rules:

```typescript
// Existing: trigger priority score recalculation
if (job.type === 'classify_batch') {
  // ... (ja existe)

  // NEW: trigger audit rule evaluation after priority scores
  const auditUrl = `${supabaseUrl}/functions/v1/evaluate-audit-rules`;
  fetch(auditUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({}),
  }).catch(() => {}); // fire-and-forget
}
```

ALTERNATIVA melhor: encadear apos calculate-priority-scores (nao apos classify_batch).
Adicionar no final de calculate-priority-scores/index.ts, apos o response ser enviado:

```typescript
// After all scores calculated and response sent, trigger audit evaluation
if (!hasMore) {
  const auditUrl = `${supabaseUrl}/functions/v1/evaluate-audit-rules`;
  fetch(auditUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({}),
  }).catch(() => {});
}
```

Vantagem: evaluate-audit-rules roda APOS os scores estarem atualizados.
Se encadeasse a partir de classify_batch, os scores poderiam nao ter sido calculados ainda.

Recomendacao: trigger em calculate-priority-scores (quando !hasMore), NAO em process-jobs.

---

#### Env vars

```
AUDIT_BATCH_SIZE=20
```

Ja existentes (nao recriar): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

---

#### Estrutura modular (mesmo padrao de calculate-priority-scores)

```
supabase/functions/evaluate-audit-rules/
  index.ts    — handler principal (Deno.serve)
  logic.ts    — funcoes puras: evaluateRule, checkCooldown (exportadas para teste)
  index.test.ts — testes unitarios
  README.md   — documentacao
```

---

#### Log policy

NUNCA logar: conteudo de interacoes, dados pessoais, alert_recipients
OK logar: rule_id, metric, metric_value, threshold, alert criado ou nao

```
// CORRETO:
console.log(`[evaluate-audit] rule=${ruleId} metric=${metric} value=${value} triggered=${triggered}`)

// PROIBIDO:
console.log(`[evaluate-audit] recipients: ${JSON.stringify(rule.alert_recipients)}`)
```

---

#### Testes unitarios (m13)

Arquivo: evaluate-audit-rules/index.test.ts

evaluateRule (5 casos):
- [ ] operator '>' com value acima do threshold → true
- [ ] operator '>' com value igual ao threshold → false
- [ ] operator '>=' com value igual ao threshold → true
- [ ] operator '<' com value abaixo do threshold → true
- [ ] operador desconhecido → false

checkCooldown (3 casos):
- [ ] Sem alerta anterior → false (pode disparar)
- [ ] Ultimo alerta ha mais tempo que cooldown_hours → false (pode disparar)
- [ ] Ultimo alerta dentro do cooldown_hours → true (nao disparar)

calculateMetric (nao testavel unitariamente — I/O puro, testado por integracao)

---

#### CTO Checklist

- [ ] m1: Zero `any`
- [ ] m8: Erros Supabase tratados
- [ ] m11: Zero imports nao usados
- [ ] m13: 8 testes unitarios (evaluateRule 5 + checkCooldown 3)
- [ ] Playbook: single-responsibility (4 funcoes modulares)
- [ ] Playbook: zero hardcoded (AUDIT_BATCH_SIZE via env)
- [ ] Playbook: logs sem dados sensiveis
- [ ] Playbook: README incluido
- [ ] PRD: batch + hasMore + auto-chain

---

#### Sequencia de deploy

1. Lovable implementa migration (se necessaria) + Edge Function + tests + README
2. Operador declara env var AUDIT_BATCH_SIZE no Supabase Dashboard
3. Lovable deploya Edge Function
4. Operador confirma types.ts regenerado (se migration)
5. Claude Code revisa PR contra CTO Checklist

---

## APONTAMENTO 4 — Conflito PR-A / PR-F resolvido

Solucao: mover jobStatusBadge dark mode de PR-A2 para PR-F.

Justificativa:
- PR-F ja e o PR principal de SettingsPage (nova aba Prioridades)
- Incluir a correcao de dark mode do jobStatusBadge no mesmo PR evita que dois PRs toquem SettingsPage
- PR-A2 fica limitado a ClientsPage, ClientDetailPage e DashboardLayout — zero conflito

Ordem resultante:
- PR-A1 e PR-A2: nao tocam SettingsPage
- PR-F: unico PR que toca SettingsPage (nova aba + fix dark mode)
- Sem risco de conflito de merge

---

## Trilha Cursor revisada (11 PRs)

| PR | Titulo | Prioridade | Arquivos | Depende de |
|----|--------|-----------|----------|------------|
| A1 | fix: error states ClientsPage + ClientDetailPage | Alta | ClientsPage, ClientDetailPage | — |
| A2 | fix: dark mode tone, shimmer, layout padding | Media | ClientsPage, ClientDetailPage, DashboardLayout | — |
| B | fix: accessibility aria-labels, focus-visible, active:scale | Media | ClientsPage, ClientDetailPage, Index | — |
| C | fix(m9): Login/Signup useMutation | Baixa | LoginPage, SignupPage | — |
| D | fix: Audits honest empty state | Alta | Audits.tsx | — |
| E | fix: NotFound React Router Link | Baixa | NotFound.tsx | — |
| F | feat: Settings Prioridades + jobStatusBadge dark mode | Alta | SettingsPage, useClientPriorityConfig | — |
| G | feat: score column in ClientsPage | Media | ClientsPage | — |
| H1 | feat: Dashboard search + tier filter | Media | Index.tsx | — |
| H2 | feat: Dashboard KPI cards + trend charts | Media | Index.tsx, componentes | Issue #34 |
| I | feat: ClientDetail score card + consolidar tabs | Media | ClientDetailPage | — |
| J | feat: recharts ClientDetail | Baixa | ClientDetailPage, componentes | — |

## Trilha Lovable revisada (2 Issues)

| Issue | Titulo | Desbloqueia |
|-------|--------|-------------|
| #34 | DB function global_stats_30d | PR-H2 |
| #35 | Edge function evaluate-audit-rules | Auditorias UI real (futuro) |

### Frontend Contracts (regra para Issues Lovable)

Toda Issue/PR do Lovable que desbloqueia trabalho do Cursor DEVE incluir secao
"Frontend Contract" no PR, contendo:

- **Return type**: campos e tipos exatos retornados pela DB function ou Edge Function
- **Suggested hook**: queryKey, staleTime recomendado, enabled condition
- **Edge cases**: valores default, arrays vazios, campos nullable

O Contract vive na Issue/PR (nunca como codigo UI). Lovable NAO cria hooks nem
componentes — o Cursor consome o Contract para criar hooks seguindo o padrao de
`usePriorityScores.ts`.

Beneficios:
- Zero risco de merge conflict (Contract nao e codigo)
- Zero overhead de review sobre UI do Lovable
- Cursor recebe info critica (tipos, edge cases) sem conflito de estilo
- Respeita AGENTS.md sem excecoes

Referencia: AGENTS.md secao 1 > Lovable > Restricoes.

---

## Sequencia Global Atualizada

```
FASE 1 — QUALIDADE (paralelo, sem dependencias):

  Cursor: PR-A1 (erro) → PR-A2 (dark+shimmer) → PR-B (a11y)
  Cursor: PR-C (Login m9)
  Cursor: PR-D (Audits empty state)
  Cursor: PR-E (NotFound Link)
  Lovable: Issue #34 (global_stats_30d)

FASE 2 — FEATURES INDEPENDENTES (paralelo):

  Cursor: PR-F (Settings Prioridades + jobStatusBadge dark)
  Cursor: PR-G (Score ClientsPage)
  Cursor: PR-H1 (Dashboard filtros/busca)
  Cursor: PR-I (ClientDetail score+tabs)
  Lovable: Issue #35 (evaluate-audit-rules)

FASE 3 — FEATURES COM DEPENDENCIA:

  Cursor: PR-H2 (Dashboard KPIs+graficos) ← depende de Issue #34
  Cursor: PR-J (Recharts ClientDetail)

FASE 4 — FASE 6 (apos Issue #35):

  Cursor: Auditorias UI real (listar/criar regras, historico, badge sidebar)
```

### Caminho critico:
```
Issue #34 (Lovable) ──→ PR-H2 (Cursor)
Issue #35 (Lovable) ──→ Auditorias UI real (Cursor, Fase 4)
```

### Podem rodar 100% em paralelo (sem dependencia entre si):
- PR-A1, PR-A2, PR-B, PR-C, PR-D, PR-E (qualidade)
- PR-F, PR-G, PR-H1, PR-I (features independentes)
- PR-J (recharts)

### Nenhum par de PRs toca o mesmo arquivo exceto:
- ClientsPage: PR-A1 (erro) → PR-A2 (dark) → PR-G (score) — sequencia obrigatoria
- ClientDetailPage: PR-A1 (erro) → PR-A2 (dark) → PR-I (score+tabs) → PR-J (recharts) — sequencia obrigatoria
- Index.tsx: PR-H1 (filtros) → PR-H2 (graficos) — sequencia obrigatoria
- SettingsPage: PR-F unico (sem conflito)

---

## Regras de Merge — Dependencias Operacionais

### Principio

Dependencias de arquivo = dependencias de MERGE.
Se dois PRs tocam o mesmo arquivo, o segundo so pode ser ABERTO apos o primeiro estar MERGEADO.
Isso evita conflitos de merge garantidos e rebase desnecessario.

### Cadeia obrigatoria — ClientsPage.tsx

```
PR-A1 (merge) → PR-A2 (abrir) → PR-A2 (merge) → PR-G (abrir)
```

- PR-A2 so pode ser ABERTO apos PR-A1 estar mergeado
- PR-G so pode ser ABERTO apos PR-A2 estar mergeado
- Motivo: todos tocam ClientsPage.tsx

### Cadeia obrigatoria — ClientDetailPage.tsx

```
PR-A1 (merge) → PR-A2 (abrir) → PR-A2 (merge) → PR-I (abrir) → PR-I (merge) → PR-J (abrir)
```

- PR-A2 so pode ser ABERTO apos PR-A1 estar mergeado
- PR-I so pode ser ABERTO apos PR-A2 estar mergeado
- PR-J so pode ser ABERTO apos PR-I estar mergeado
- Motivo: todos tocam ClientDetailPage.tsx

### Cadeia obrigatoria — Index.tsx

```
PR-H1 (merge) → PR-H2 (abrir)
```

- PR-H2 so pode ser ABERTO apos PR-H1 estar mergeado
- Motivo: ambos tocam Index.tsx
- Nota adicional: PR-H2 tambem depende de Issue #34 (backend). So abrir quando AMBOS estiverem prontos (PR-H1 mergeado + Issue #34 concluido)

### PRs sem dependencia de merge (podem ser abertos a qualquer momento)

| PR | Arquivo(s) exclusivo(s) | Conflito possivel |
|----|------------------------|-------------------|
| PR-B | ClientsPage, ClientDetailPage, Index | ⚠️ Toca arquivos das cadeias acima |
| PR-C | LoginPage, SignupPage | Nenhum |
| PR-D | Audits.tsx | Nenhum |
| PR-E | NotFound.tsx | Nenhum |
| PR-F | SettingsPage, usePriorityConfig | Nenhum |

### Caso especial: PR-B (acessibilidade)

PR-B toca ClientsPage.tsx, ClientDetailPage.tsx e Index.tsx — todos arquivos de cadeias obrigatorias.

**Regra:** PR-B deve ser mergeado APOS PR-A2 e ANTES de PR-G, PR-I e PR-H1.
Cadeia ajustada:

```
ClientsPage:     PR-A1 → PR-A2 → PR-B → PR-G
ClientDetailPage: PR-A1 → PR-A2 → PR-B → PR-I → PR-J
Index.tsx:        PR-B → PR-H1 → PR-H2
```

### Sinalizacao nas PRs

Todo PR que depende de merge anterior DEVE incluir na descricao:

```
## Dependencias de merge
⛔ Blocked by: PR-A2 (#XX)
Nao fazer merge ate que PR-A2 esteja mergeado.
```

O Cursor deve:
1. Incluir essa secao na descricao de todo PR com dependencia
2. Usar label `blocked` no GitHub enquanto o PR anterior nao for mergeado
3. Remover label e solicitar review apos o merge do PR anterior

### Ordem operacional completa (para o Operador)

```
LOTE 1 — Abrir e mergear imediatamente (paralelo, sem dependencias):
  PR-A1, PR-C, PR-D, PR-E, PR-F

LOTE 2 — Abrir apos merge do LOTE 1:
  PR-A2 (apos PR-A1 mergeado)

LOTE 3 — Abrir apos merge de PR-A2:
  PR-B (apos PR-A2 mergeado)

LOTE 4 — Abrir apos merge de PR-B:
  PR-G (ClientsPage livre)
  PR-H1 (Index.tsx livre)
  PR-I (ClientDetailPage livre)

LOTE 5 — Abrir apos merge do LOTE 4:
  PR-H2 (apos PR-H1 mergeado + Issue #34 concluida)
  PR-J (apos PR-I mergeado)
```

---

## Bloco Autonomo — Trabalho sem intervencao do Operador

### O que o Claude Code pode fazer agora (autonomamente):

**Issues GitHub para Lovable:**
- [ ] Criar Issue #34 (global_stats_30d) — completa, self-contained
- [ ] Criar Issue #35 (evaluate-audit-rules) — completa, self-contained

**Prompts para Cursor — LOTE 1 (sem dependencias de merge):**
- [ ] Gerar prompt PR-A1 (error states)
- [ ] Gerar prompt PR-C (Login/Signup useMutation)
- [ ] Gerar prompt PR-D (Audits empty state)
- [ ] Gerar prompt PR-E (NotFound Link)
- [ ] Gerar prompt PR-F (Settings Prioridades + jobStatusBadge dark)

**Documentacao:**
- [ ] Atualizar CONTEXT.md com o plano aprovado

### O que REQUER o Operador:

**Sequenciamento de merge (Operador orquestra):**
- Mergear LOTE 1 e liberar LOTE 2 (PR-A2)
- Mergear PR-A2 e liberar LOTE 3 (PR-B)
- Mergear PR-B e liberar LOTE 4 (PR-G, PR-H1, PR-I)
- Mergear LOTE 4 e liberar LOTE 5 (PR-H2, PR-J)

**Backend (Operador + Lovable):**
- Copiar Issue #34 e #35 para Lovable
- Declarar env var AUDIT_BATCH_SIZE no Supabase Dashboard
- Confirmar types.ts regenerado

**Prompts para Cursor — LOTES 2-5 (dependem de merge anterior):**
- Gerar prompt PR-A2 apos merge de PR-A1
- Gerar prompt PR-B apos merge de PR-A2
- Gerar prompts PR-G, PR-H1, PR-I apos merge de PR-B
- Gerar prompts PR-H2, PR-J apos merge de LOTE 4

---

## Itens Deliberadamente Excluidos (mantidos do v1)

| Item | Motivo |
|------|--------|
| Remover tab Tasks 🔒 | Regra: nunca sem aprovacao explicita do Operador |
| Alertas WhatsApp/Slack/Email | Integracoes externas nao confirmadas — Fase 7+ |
| LineChart 12 semanas ClientDetail | Requer expandir query para 90d — avaliar performance |
| Redesign completo | Regra: evoluir incrementalmente |
| Novas libs (framer-motion) | tailwindcss-animate suficiente |
| Tabs agrupamento mobile | Decisao de produto, nao bug |
| SettingsPage loading/erro por aba | Escopo grande, sem bug critico |
| sentiment como metrica | Sem caso de uso definido |
| classification_model stats | Diagnostico, nao usuario final |
