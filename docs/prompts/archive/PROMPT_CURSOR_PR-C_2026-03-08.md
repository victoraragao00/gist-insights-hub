Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: fix/auth-use-mutation
Prioridade: BAIXA

Leia CONTEXT.md antes de comecar.

## PR-C: fix(m9): replace manual submitting state with useMutation in auth pages

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
