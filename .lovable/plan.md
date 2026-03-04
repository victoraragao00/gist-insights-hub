

# Problema: Botão de importação não aparece quando o Gist já está vinculado

O botão "Conectar Gist" só aparece quando **não existe** binding Gist. Como o binding já foi criado (screenshot mostra "Gist Chat - Ativo"), o botão sumiu e não há como acessar a importação histórica.

## Solução

Adicionar um botão **"Importar Histórico"** na seção de Canais Vinculados, visível quando o binding Gist **já existe**. Esse botão chama diretamente a edge function `ingest-gist-historical` (Step C do wizard), sem precisar passar pela descoberta e vinculação novamente.

### Alteração: `src/pages/ClientsPage.tsx`

Na seção de channel bindings (após a lista de bindings, ~linha 500-514), adicionar:

- Quando `hasGistBinding` é `true`: mostrar botão "Importar Histórico do Gist" que chama `handleImportHistory` diretamente
- Botão desabilitado enquanto `importing` é `true`
- Spinner + mensagem "Importando conversas..." durante o loading
- Manter o botão "Conectar Gist" apenas quando `!hasGistBinding`

### Nenhum outro arquivo será alterado

- Edge functions permanecem iguais
- Contextos, sidebar, layout — tudo preservado

