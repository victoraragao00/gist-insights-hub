# ACAO OBRIGATORIA: Re-clonar repositorio

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: CRITICA
Data: 2026-03-09

---

## O que aconteceu

O historico do git foi reescrito para remover o arquivo `.env` que continha credenciais e estava commitado desde o setup inicial. Um `git filter-repo` foi executado seguido de `force push`.

**Seu clone local esta com historico invalido.** Qualquer `git pull` vai falhar ou causar conflitos irrecuperaveis.

---

## O que voce DEVE fazer

### Opcao A — Re-clonar (recomendado)

```bash
# 1. Salvar trabalho nao commitado (se houver)
cd gist-insights-hub
git stash

# 2. Sair da pasta e re-clonar
cd ..
mv gist-insights-hub gist-insights-hub-OLD
git clone https://github.com/HyTrackWater/gist-insights-hub.git

# 3. Restaurar .env (obrigatorio — nao esta mais no repo)
cp gist-insights-hub-OLD/.env gist-insights-hub/.env

# 4. Instalar dependencias
cd gist-insights-hub
npm install

# 5. Verificar que funciona
npm run dev

# 6. Depois de confirmar que tudo funciona, apagar o clone antigo
rm -rf ../gist-insights-hub-OLD
```

### Opcao B — Reset do historico (avancado)

```bash
cd gist-insights-hub
git fetch origin
git reset --hard origin/main
```

**ATENCAO:** isso apaga qualquer trabalho local nao commitado.

---

## Mudancas importantes

1. `.env` **nao existe mais no repositorio** — esta no `.gitignore`
2. `.env.example` foi criado com valores vazios (referencia)
3. Se voce nao tem o `.env` local, crie a partir do `.env.example` e preencha:
   ```
   VITE_SUPABASE_PROJECT_ID="qyfwbmukylyfsgzgocfo"
   VITE_SUPABASE_PUBLISHABLE_KEY="[pedir ao Operador]"
   VITE_SUPABASE_URL="https://qyfwbmukylyfsgzgocfo.supabase.co"
   ```

---

## NAO FAZER

- Nao tentar `git pull` no clone antigo — vai falhar
- Nao commitar o `.env` novamente — esta no `.gitignore` por seguranca
- Nao compartilhar a anon key em PRs, Issues ou documentos publicos
