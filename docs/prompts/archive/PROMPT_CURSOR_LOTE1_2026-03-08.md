# Prompts para Cursor — LOTE 1 (5 PRs independentes)
# Data: 2026-03-08
# Instrucao: enviar cada bloco como prompt separado ao Cursor
# Todos podem rodar em paralelo — sem dependencia entre si

=====================================================================
## PR-A1: fix: error states in ClientsPage and ClientDetailPage
## Prioridade: ALTA
## Branch: fix/error-states-clients
=====================================================================

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

### Problema

ClientsPage.tsx e ClientDetailPage.tsx nao tratam isError do useQuery.
Se a query falhar, o usuario ve a pagina vazia sem feedback.

### Tarefas

**ClientsPage.tsx:**

1. Extrair `isError` e `error` do useQuery existente (linha ~86)
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

3. Extrair `refetch` do useQuery tambem
4. Imports necessarios: Alert, AlertTitle, AlertDescription de @/components/ui/alert; AlertTriangle de lucide-react

**ClientDetailPage.tsx:**

1. Extrair `isError` e `error` do useQuery de client (linha ~87 aprox)
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

3. Extrair `refetch` do useQuery de client
4. O bloco existente `if (!client)` continua como esta — cobre o caso de client null sem erro

### Nao fazer
- Nao alterar estilos, cores ou layout existente
- Nao tocar em SettingsPage
- Nao adicionar error boundaries (isso e outro PR)

### CTO Checklist
- m3: usar toast apenas se necessario (aqui usar Alert inline, nao toast)
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


=====================================================================
## PR-C: fix(m9): Login/Signup useMutation
## Prioridade: BAIXA
## Branch: fix/auth-use-mutation
=====================================================================

Leia CONTEXT.md antes de comecar.

### Problema

LoginPage.tsx e SignupPage.tsx usam useState manual para controlar `submitting`.
Checklist m9 exige useMutation para operacoes de escrita.

### Tarefas

**LoginPage.tsx (104 linhas):**

1. Remover `const [submitting, setSubmitting] = useState(false);`
2. Criar mutation:

```tsx
const loginMutation = useMutation({
  mutationFn: async (values: LoginForm) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
  },
  onSuccess: () => navigate("/"),
  onError: (err: Error) => toast.error(err.message || "Erro ao fazer login"),
});
```

3. Substituir `onSubmit={handleSubmit(onSubmit)}` por `onSubmit={handleSubmit((v) => loginMutation.mutate(v))}`
4. Substituir `submitting` por `loginMutation.isPending` em disabled e no botao
5. Remover a funcao `onSubmit` inteira
6. Import: `import { useMutation } from "@tanstack/react-query";`

**SignupPage.tsx (121 linhas):**

1. Remover `const [submitting, setSubmitting] = useState(false);`
2. Manter `const [success, setSuccess] = useState(false);` (controle de tela, nao de loading)
3. Criar mutation:

```tsx
const signupMutation = useMutation({
  mutationFn: async (values: SignupForm) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
  },
  onSuccess: () => setSuccess(true),
  onError: (err: Error) => toast.error(err.message || "Erro ao criar conta"),
});
```

4. Substituir `submitting` por `signupMutation.isPending`
5. Remover a funcao `onSubmit` inteira
6. Import: `import { useMutation } from "@tanstack/react-query";`

### Nao fazer
- Nao alterar o visual dos formularios
- Nao alterar validacao Zod
- Nao remover useId (esta correto)

### CTO Checklist
- m9: useMutation para escrita (principal)
- m11: zero imports nao usados (remover useState se nao mais usado no LoginPage)

### Criterios de aceitacao
- Login e Signup funcionam normalmente
- Botao mostra loading state via isPending
- Toast de erro via onError
- Zero useState para controle de submitting

### PR
- Titulo: `fix(m9): replace manual submitting state with useMutation in auth pages`
- Branch: `fix/auth-use-mutation`
- Arquivos: LoginPage.tsx, SignupPage.tsx


=====================================================================
## PR-D: fix: Audits honest empty state
## Prioridade: ALTA
## Branch: fix/audits-empty-state
=====================================================================

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

### Problema

Audits.tsx (39 linhas) mostra um botao "Criar primeira auditoria" que nao faz nada.
A Edge Function evaluate-audit-rules ainda nao existe (Issue #38, pendente).
O botao cria expectativa falsa.

### Tarefas

1. Remover o `<Button>` "Criar primeira auditoria" (e o import de Plus se ficar sem uso)
2. Alterar o texto para ser honesto sobre o estado:

```tsx
<h3 className="text-lg font-semibold">Auditorias em breve</h3>
<p className="text-muted-foreground mt-1 max-w-md">
  O sistema de alertas automaticos esta em desenvolvimento.
  Voce sera notificado quando regras de auditoria estiverem disponiveis.
</p>
```

3. Manter o icone ShieldAlert e a estrutura do Card

### Nao fazer
- Nao adicionar queries ou hooks (nao ha dados ainda)
- Nao alterar o layout do DashboardLayout

### CTO Checklist
- m11: zero imports nao usados (remover Plus e Button se nao usados)

### Criterios de aceitacao
- Pagina Auditorias mostra mensagem honesta sem botao enganoso
- Zero imports nao usados

### PR
- Titulo: `fix: honest empty state for Audits page`
- Branch: `fix/audits-empty-state`
- Arquivos: Audits.tsx


=====================================================================
## PR-E: fix: NotFound React Router Link
## Prioridade: BAIXA
## Branch: fix/notfound-router-link
=====================================================================

Leia CONTEXT.md antes de comecar.

### Problema

NotFound.tsx usa `<a href="/">` (HTML anchor) em vez de `<Link to="/">` do React Router.
Isso causa full page reload desnecessario.

### Tarefas

1. Substituir:
```tsx
<a href="/" className="text-primary underline hover:text-primary/90">
  Voltar para o inicio
</a>
```

Por:
```tsx
<Link to="/" className="text-primary underline hover:text-primary/90">
  Voltar para o inicio
</Link>
```

2. Import: `import { Link, useLocation } from "react-router-dom";`
   (useLocation ja e importado, apenas adicionar Link ao import existente)

### Nao fazer
- Nao alterar estilos
- Nao alterar o useEffect de log

### CTO Checklist
- m11: zero imports nao usados

### Criterios de aceitacao
- Link navega sem full reload
- Visual identico

### PR
- Titulo: `fix: use React Router Link in NotFound page`
- Branch: `fix/notfound-router-link`
- Arquivos: NotFound.tsx


=====================================================================
## PR-F: feat: Settings Prioridades + jobStatusBadge dark mode
## Prioridade: ALTA
## Branch: feat/settings-priorities-tab
=====================================================================

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

### Problema

1. SettingsPage nao tem aba para gerenciar configuracao de prioridades (client_priority_config)
2. jobStatusBadge usa cores light-only (bg-yellow-50, bg-blue-50 etc) sem variante dark

### Tarefa 1 — Nova aba "Prioridades"

Adicionar 4a aba no TabsList existente (integrations, sync, uploads → + priorities).

Conteudo da aba:
- Tabela listando todos os clients com sua config de prioridade
- Colunas: Nome do cliente, Tier (badge), Weight (peso numerico), Ativo (switch)
- Dados: useQuery em client_priority_config JOIN clients (para nome)
- Edicao inline: o admin pode alterar tier e weight com useMutation
- Apenas admin pode editar (usar useUserRole do hook existente em src/hooks/useUserRole.ts)
- Viewer ve a tabela read-only

Hook sugerido (criar em src/hooks/useClientPriorityConfig.ts):
```tsx
export function useClientPriorityConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-priority-config", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_priority_config")
        .select("*, clients(name)")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}
```

### Tarefa 2 — jobStatusBadge dark mode

Atualizar a funcao jobStatusBadge (dentro de SettingsPage.tsx) para usar pares light/dark:

```
pending:   bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800
running:   bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800
completed: bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800
failed:    bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800
```

### Nao fazer
- Nao tocar em outras abas (integrations, sync, uploads)
- Nao alterar o layout geral da pagina
- Nao criar pagina nova — e uma aba dentro de SettingsPage

### CTO Checklist
- m1: zero `any` — tipar config rows
- m4: staleTime 5min (configs mudam raramente)
- m5: queryKey com user?.id
- m8: erros Supabase tratados
- m9: useMutation para edicao de tier/weight
- m11: zero imports nao usados

### Criterios de aceitacao
- Nova aba "Prioridades" visivel e funcional
- Admin pode alterar tier e weight inline
- Viewer ve tabela read-only
- jobStatusBadge com cores corretas em dark mode
- Zero regressao nas outras abas

### PR
- Titulo: `feat: Settings priorities tab + jobStatusBadge dark mode`
- Branch: `feat/settings-priorities-tab`
- Arquivos: SettingsPage.tsx, src/hooks/useClientPriorityConfig.ts (novo)
