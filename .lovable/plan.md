

# Fix: Importação interrompida ao navegar para outra página

## Problema
O `handleImportHistory` executa um loop `while` assíncrono dentro do componente `ClientsPage`. Quando o usuário navega para outra rota (ex: "Interações"), o React desmonta o componente, o loop morre silenciosamente, e ao voltar o estado reinicia zerado mostrando o botão "Importar Histórico" como se nada tivesse acontecido.

## Solução

Duas melhorias complementares:

### 1. Prevenir navegação durante importação
Adicionar um alerta/bloqueio visual quando `importing === true`. Usar `window.onbeforeunload` e interceptar cliques na sidebar durante importação com um `toast.warning("Importação em andamento, aguarde...")`.

### 2. Continuar importação mesmo ao navegar (abordagem robusta)
Mover o estado da importação para o `ClientContext` (que vive acima das rotas e não desmonta). Assim o loop continua rodando mesmo se o usuário trocar de página, e ao voltar para `/clients` o progresso aparece atualizado.

### Alterações

**`src/context/ClientContext.tsx`**
- Adicionar ao contexto: `importing`, `importProgress`, `handleImportHistory()` 
- Mover a lógica do loop de importação para cá

**`src/pages/ClientsPage.tsx`**
- Consumir `importing`, `importProgress`, `handleImportHistory` do `ClientContext` em vez de estado local
- Remover a lógica duplicada

Nenhum outro arquivo será alterado.

