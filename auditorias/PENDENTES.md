# PENDENTES — Violações em Aberto

> Atualizado automaticamente pelo Cowork após cada auditoria.
> Última atualização: 2026-03-08

---

## Em Aberto

### 🟡 ATENÇÃO

| ID | Arquivo | Linha | Descrição | Detectado em |
|----|---------|-------|-----------|--------------|
| A1 | SearchPage.tsx | 60-61 | useEffect referencia `clientSearchError` antes da declaração (TDZ) | AUDITORIA_20260308_2142 |
| A2 | Audits.tsx | 626-627 | `key={i}` em lista dinâmica de recipients — viola .cursor/rules #10 | AUDITORIA_20260308_2142 |

### 🟢 OBSERVAÇÕES

| ID | Arquivo | Linha | Descrição | Detectado em |
|----|---------|-------|-----------|--------------|
| O1 | useAuditRules.ts | 16 | `alert_recipients: unknown` — poderia ser `Array<{type: string; value: string}>` | AUDITORIA_20260308_2142 |
| O2 | SearchPage/ClientDetailPage/Index | - | TONE_CONFIG duplicado em 3 páginas (DRY) | AUDITORIA_20260308_2142 |
| O3 | useAuditRules.ts | 32 | queryKey não inclui `limit` (impacto zero hoje) | AUDITORIA_20260308_2142 |

---

## Resolvidas

_Nenhuma violação resolvida ainda._
