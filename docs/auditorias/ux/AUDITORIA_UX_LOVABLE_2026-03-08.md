# Auditoria UX/UI — Lovable (estratégica) — 2026-03-08

## 1. Dashboard: KPIs e graficos ausentes
- KPI cards globais (total interacoes 30d, % critico, clientes monitorados)
- Grafico evolucao tom por mes (stacked bar)
- Top 5 temas (bar horizontal)
- Backend: DB function global_stats_30d recomendada
- Responsavel: Lovable (migration) + Cursor (UI)

## 2. Settings → Prioridades
- Nova aba admin-only
- Tabela editavel: tier, peso, janela, threshold, ativo
- Frontend puro (RLS ja pronta)
- Responsavel: Cursor

## 3. Pagina Auditorias
- Listar audit_rules com toggle
- Formulario criar regra
- Historico audit_alerts
- Badge sidebar alertas pending
- Backend: edge function evaluate-audit-rules
- Responsavel: Lovable (EF) + Cursor (UI)

## 4. ClientDetailPage — consolidar tabs
- Mover Settings → Regras de Negocio
- Remover Tasks (CONFLITO: regra diz nunca remover sem aprovacao)
- Card Priority Score na Visao Geral
- Top 5 temas na Visao Geral
- Responsavel: Cursor

## 5. Recharts no ClientDetailPage
- AreaChart volume 14d
- PieChart tone distribution
- LineChart evolucao tom 12 semanas
- Responsavel: Cursor

## 6. Score na ClientsPage
- Nova coluna Score + tier badge
- Mini barra progresso
- Ordenavel
- Responsavel: Cursor

## 7. Alertas automaticos (Fase 6)
- Edge function evaluate-audit-rules
- Badge sidebar + toast realtime
- Responsavel: Lovable (EF) + Cursor (UI)

## 8. Dados nao utilizados
- theme/theme_detail, sentiment, classification_model, participants.role, sync_jobs.progress
