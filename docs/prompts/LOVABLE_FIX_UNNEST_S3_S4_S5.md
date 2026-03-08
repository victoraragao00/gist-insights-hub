# ~~CORRECAO OBRIGATORIA: unnest() em audit_alerts_summary, search_interactions, client_tone_trend_7d~~

## CANCELADO — Prompt incorreto

**Data:** 2026-03-08
**Motivo:** `user_accessible_client_ids()` retorna `SETOF uuid` (nao `uuid[]`). O `unnest()` nao se aplica — cada row ja e um uuid escalar. As 3 funcoes (S3, S4, S5) estao corretas como entregues.

**Evidencia:** Lovable tentou aplicar a migration e o banco rejeitou com `function unnest(uuid) does not exist`. O Lovable parou e reportou ao Operador conforme instruido.

**Erro do Claude Code:** assumiu `RETURNS uuid[]` baseado no TypeScript (`Returns: string[]`), sem verificar a definicao real da funcao no PostgreSQL. Violou a propria regra de "todo codigo revisado com mesmo rigor que PR humano" — neste caso, a revisao foi feita sobre premissa errada.

**Correcao no processo:** AGENTS.md atualizado — SQL Pattern sobre `unnest()` removido. Claude Code deve verificar `RETURNS` real da funcao no banco antes de exigir patterns.
