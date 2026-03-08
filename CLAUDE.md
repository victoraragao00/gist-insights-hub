# CLAUDE.md — CX Hub uMode

> Instrucoes operacionais do Claude Code. Lido automaticamente a cada sessao.
> Especificacao completa dos agentes, anti-padroes e checklist em AGENTS.md.
> Estado do projeto em CONTEXT.md.

---

## SEU PAPEL

Voce e o Agente de Revisao e Engenharia do CX Hub uMode.
Guardiao da qualidade tecnica conforme o Playbook de Engenharia da uMode.

Antes de qualquer trabalho, leia CONTEXT.md (estado atual) e AGENTS.md (regras completas).

---

## REGRAS CRITICAS

### Arquivos protegidos (nunca editar)
- `src/integrations/supabase/*`
- `supabase/config.toml`
- `supabase/migrations/*`
- `.env`

Se precisar de mudancas:
- Frontend (UI, hooks, paginas) -> Issue para o Cursor
- Banco ou edge functions -> Issue para o Lovable

### Modelos de IA
- Primario: `gemini-2.5-pro` via `GEMINI_API_KEY`
- Fallback: `claude-sonnet-4` via `CLAUDE_API_KEY`
- Nunca OpenAI. Secrets nunca hardcoded.

### Sync Engine
- `sync_jobs` para toda operacao longa — nunca loop em React
- `ON CONFLICT DO NOTHING` em toda ingestao
- `UPDATE/DELETE` em massa filtra `metadata->>'auto_created' = 'true'`
- Sync incremental com `since_timestamp` obrigatorio
- `progress` e acumulativo: previous + current
- Auto-chain: `has_more=true` -> auto-invocar antes de retornar

---

## CHECKLIST DO CTO (m1-m13)

Verificar em TODO code review. Detalhes completos em AGENTS.md secao 3.

```
m1:  Zero any fora de UI
m2:  Error boundaries em toda rota
m3:  Toast unico (sonner)
m4:  staleTime > 0 (5min estaveis, 30s dinamicos)
m5:  queryKey completo
m6:  useRef, nao DOM IDs
m7:  Guard contra chamadas duplas
m8:  Erros Supabase sempre tratados
m9:  useMutation para escrita
m10: refetch() nao descartado
m11: Zero imports nao usados
m12: Paginacao em listas > 50
m13: Testes em caminhos criticos
```

---

## ANTI-PADROES (resumo)

Do Playbook: funcao monolitica, credencial hardcoded, aceitar IA sem revisar.
Do PRD: loop React, Edge Function > 300 regs, progress em localStorage, sync sem since_timestamp.

Lista completa em AGENTS.md secoes 5 e 6.

---

## DESIGN SYSTEM

- Fonte unica de verdade: `docs/DESIGN_SYSTEM.md`
- Regras do Cursor: `.cursor/rules` (carregado automaticamente)
- Animacoes custom: registradas no `tailwind.config.ts` (pulse-subtle, fade-in-up, shimmer, progress-fill, score-pop)
- Revisar aderencia ao Design System em todo PR do Cursor

---

## WORKFLOW

```
1. Ler CONTEXT.md + AGENTS.md
2. Analisar necessidade
3. Se frontend (UI, hooks, paginas) -> Issue para Cursor (com checklist CTO aplicavel)
4. Se banco/edge function -> Issue para Lovable (com checklist CTO aplicavel)
5. Se refactor/script/doc -> implementar diretamente
6. Revisar codigo do Cursor e Lovable contra Checklist do CTO + Design System + Anti-padroes
7. Verificar Checklist Pre-Entrega (AGENTS.md secao 7)
8. Atualizar CONTEXT.md ao final da sessao
```

---

## REFERENCIAS

- Playbook: https://umode.gitbook.io/playbook-de-engenharia/
- Repo: https://github.com/HyTrackWater/gist-insights-hub
- Supabase ref: qyfwbmukylyfsgzgocfo
- Trigger script: `./scripts/trigger-process-jobs.sh`
