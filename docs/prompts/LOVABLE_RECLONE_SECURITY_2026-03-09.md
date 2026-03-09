# ACAO OBRIGATORIA: Sincronizar repositorio

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: CRITICA
Data: 2026-03-09

---

## OBRIGATORIO

1. Sincronizar com o repositorio remoto — o historico foi reescrito (force push)
2. Verificar que o `.env` NAO esta no repositorio (foi removido por seguranca)
3. Continuar usando env vars do Supabase Dashboard para Edge Functions (sem mudanca)

## PROIBIDO

1. Commitar qualquer arquivo `.env` no repositorio
2. Hardcodar keys, tokens ou secrets em codigo
3. Referenciar a anon key em qualquer arquivo commitado

---

## O que aconteceu

O arquivo `.env` estava commitado no repositorio publico desde o setup inicial (commit do gpt-engineer-app). Continha a anon key (JWT) do Supabase. O historico do git foi limpo com `git filter-repo` e force push para remover a exposicao.

---

## Impacto para o Lovable

### Se o Lovable sincroniza via GitHub:
O Lovable deve detectar o force push e re-sincronizar automaticamente. Se houver erro de sincronizacao, use o painel do Lovable para reconectar ao repositorio.

### Se o Lovable usa clone local:
```bash
git fetch origin
git reset --hard origin/main
```

### Edge Functions:
**Nenhuma mudanca.** As Edge Functions continuam usando `Deno.env.get()` para acessar secrets configurados no Supabase Dashboard. Nenhuma credencial foi alterada no ambiente de runtime.

---

## Mudancas no repositorio

1. `.env` removido do tracking e do historico completo do git
2. `.env` adicionado ao `.gitignore`
3. `.env.example` criado com valores vazios (referencia para devs)

---

## Regra permanente

A partir de agora, **nenhum arquivo `.env`** sera aceito no repositorio. O `.gitignore` bloqueia automaticamente. Se o Lovable precisar referenciar variaveis de ambiente em documentacao ou prompts, usar apenas os NOMES das variaveis (ex: `GEMINI_API_KEY`), nunca os valores.
