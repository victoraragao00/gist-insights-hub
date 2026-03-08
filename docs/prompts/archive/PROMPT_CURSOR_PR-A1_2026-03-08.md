Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: fix/error-states-clients
Prioridade: ALTA

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

## PR-A1: fix: error states in ClientsPage and ClientDetailPage

### Problema

ClientsPage.tsx e ClientDetailPage.tsx nao tratam isError do useQuery.
Se a query falhar, o usuario ve a pagina vazia sem feedback.

### Tarefas

**ClientsPage.tsx:**

1. Extrair `isError`, `error` e `refetch` do useQuery existente (linha ~86)
2. Adicionar bloco de erro ANTES do render principal (apos o loading skeleton):

```tsx
if (isError) {
  return (
    <Alert variant="destructive" className="mx-auto max-w-lg mt-12">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Erro ao carregar clientes</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{error instanceof Error ? error.message : "Erro desconhecido"}</span>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

3. Imports necessarios: Alert, AlertTitle, AlertDescription de @/components/ui/alert; AlertTriangle de lucide-react

**ClientDetailPage.tsx:**

1. Extrair `isError`, `error` e `refetch` do useQuery de client (linha ~87 aprox)
2. Adicionar bloco de erro ANTES do "Cliente nao encontrado" (que ja existe):

```tsx
if (isError) {
  return (
    <Alert variant="destructive" className="mx-auto max-w-lg mt-12">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Erro ao carregar cliente</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{error instanceof Error ? error.message : "Erro desconhecido"}</span>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

3. O bloco existente `if (!client)` continua como esta — cobre o caso de client null sem erro

### Nao fazer
- Nao alterar estilos, cores ou layout existente
- Nao tocar em SettingsPage
- Nao adicionar error boundaries (isso e outro PR)

### CTO Checklist
- m3: usar Alert inline, nao toast
- m8: erros tratados explicitamente
- m11: zero imports nao usados

### Criterios de aceitacao
- ClientsPage com erro: Alert destructive + botao retry visivel
- ClientDetailPage com erro: Alert destructive + retry
- ClientDetailPage sem erro e sem client: "Cliente nao encontrado" (ja existe)
- Zero regressao visual

### PR
- Titulo: `fix: error states in ClientsPage and ClientDetailPage`
- Branch: `fix/error-states-clients`
- Arquivos: ClientsPage.tsx, ClientDetailPage.tsx (apenas logica de erro)
