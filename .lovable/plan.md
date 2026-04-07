

## Plan: Mover botão IA para Resumo Executivo + Reordenar seções

### Alterações

#### 1. `src/pages/AgendaDetailPage.tsx`

**Botão "Processar com IA":**
- Remover o botão duplicado da seção Transcrição (linhas 530-547)
- No card Resumo Executivo, alterar a condição do botão: remover a exigência de `transcription.trim()` — o botão deve aparecer sempre, pois a IA processará com base em objective, contextNotes e nextSteps (não apenas transcrição)
- Condição do botão: sempre visível (disabled apenas se `isProcessing`)
- Texto: "Processar com IA" se `!ai_processed`, "Reprocessar" se `ai_processed`

**Reordenar seções na página:**
- Objetivo (collapsible)
- Notas de Contexto (collapsible)
- Próximos Passos (collapsible)
- Transcrição (collapsible) — **antes** de Lições de Casa
- Lições de Casa (collapsible) — **depois** de Transcrição

**`handleProcessAI`:**
- Remover exigência de `transcription.trim()` — permitir processar mesmo sem transcrição, desde que tenha objective/contextNotes/nextSteps

#### 2. `CONTEXT.md`
- Atualizar para v27 (2026-04-07)
- Documentar: botão IA movido para Resumo Executivo, reordenação de seções, prompt enriquecido com campos de contexto

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/AgendaDetailPage.tsx` (button placement + section order + relax condition) |
| Edit | `CONTEXT.md` (v27 update) |

### No changes to
- Hooks, edge functions, migrations, RLS, `src/integrations/supabase/*`, `.env`

