# PR: feat: edição de cliente na tab Configurações

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/client-edit-settings`
Prioridade: ALTA
Issue: #59

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

---

## Problema

ClientDetailPage tem 7 tabs. A tab "Configuracoes" mostra SLA (read-only), alertas (toggle) e zona de perigo. Nao existe UI para editar nome, status, scope ou tier do cliente. O campo `metadata.scope` vive incorretamente na tab "Regras de Negocio" — deve ser movido para "Configuracoes".

---

## Tarefa 1 — Mover scope da tab "Regras de Negocio" para "Configuracoes"

Em `ClientDetailPage.tsx`:

1. **Remover** da tab "Regras de Negocio" (TabsContent value="rules"):
   - O Textarea do scope (linhas ~863-868)
   - O Button "Salvar Escopo" (linhas ~869-876)
   - O titulo "Escopo contratado" e seu container

2. O `saveScopeMutation` (linhas ~390-406) e o estado `scopeText` continuam existindo — serao usados na tab Configuracoes.

---

## Tarefa 2 — Secao "Dados do Cliente" na tab Configuracoes

Adicionar como PRIMEIRA secao dentro do TabsContent value="settings", ACIMA do grid existente de SLA e Alertas:

```tsx
<Card className="border-border">
  <CardHeader className="pb-2">
    <CardTitle className="text-base font-semibold">Dados do cliente</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Formulario aqui */}
  </CardContent>
</Card>
```

### Campos do formulario

**Para admin (isAdmin === true):**

```tsx
// Nome
<div className="space-y-1">
  <label className="text-sm font-medium">Nome</label>
  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
</div>

// Status
<div className="space-y-1">
  <label className="text-sm font-medium">Status</label>
  <Select value={editStatus} onValueChange={setEditStatus}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="ativo">Ativo</SelectItem>
      <SelectItem value="trial">Trial</SelectItem>
      <SelectItem value="inativo">Inativo</SelectItem>
    </SelectContent>
  </Select>
</div>

// Escopo contratado (movido da tab Regras de Negocio)
<div className="space-y-1">
  <label className="text-sm font-medium">Escopo contratado</label>
  <Textarea rows={3} value={scopeText ?? ""} onChange={(e) => setScopeText(e.target.value)} placeholder="Descreva o escopo do contrato..." />
</div>

// Tier
<div className="space-y-1">
  <label className="text-sm font-medium">Tier de prioridade</label>
  <Select value={editTier} onValueChange={setEditTier}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="azzas">Azzas</SelectItem>
      <SelectItem value="enterprise">Enterprise</SelectItem>
      <SelectItem value="medium">Medium</SelectItem>
      <SelectItem value="small">Small</SelectItem>
    </SelectContent>
  </Select>
</div>

// Botao salvar
<Button onClick={handleSaveClient} disabled={saveClientMutation.isPending}>
  {saveClientMutation.isPending ? "Salvando..." : "Salvar"}
</Button>
```

**Para viewer (isAdmin === false):**

Mesmos campos mas como texto read-only, sem inputs:

```tsx
<div className="space-y-1">
  <p className="text-sm font-medium">Nome</p>
  <p className="text-sm text-muted-foreground">{client.name}</p>
</div>
// ... mesmo padrao para status (com badge), scope, tier (com badge)
```

---

## Tarefa 3 — Estados do formulario

Adicionar estados para os campos editaveis. Inicializar quando `client` carregar:

```tsx
const [editName, setEditName] = useState("");
const [editStatus, setEditStatus] = useState("ativo");
const [editTier, setEditTier] = useState("medium");

// Inicializar quando client carrega (useEffect existente ou novo)
useEffect(() => {
  if (client) {
    setEditName(client.name);
    setEditStatus(client.status);
    setScopeText((client.metadata as ClientMetadata)?.scope ?? "");
  }
}, [client]);

// Tier vem do clientScore (usePriorityScores)
useEffect(() => {
  if (clientScore) {
    setEditTier(clientScore.tier);
  }
}, [clientScore]);
```

---

## Tarefa 4 — Mutation de salvar

Criar `saveClientMutation` (substitui e amplia o `saveScopeMutation` existente):

```tsx
const saveClientMutation = useMutation({
  mutationFn: async () => {
    if (!client) throw new Error("Cliente nao encontrado");

    // 1. Atualizar clients (name, status, metadata.scope)
    const existingMeta = (client.metadata ?? {}) as Record<string, unknown>;
    const { error: clientErr } = await supabase
      .from("clients")
      .update({
        name: editName,
        status: editStatus,
        metadata: { ...existingMeta, scope: scopeText },
      })
      .eq("id", client.id);
    if (clientErr) throw clientErr;

    // 2. Upsert client_priority_config (tier)
    const { error: configErr } = await supabase
      .from("client_priority_config")
      .upsert(
        {
          client_id: client.id,
          tier: editTier as "azzas" | "enterprise" | "medium" | "small",
          weight_multiplier: editTier === "azzas" ? 3 : editTier === "enterprise" ? 2 : editTier === "medium" ? 1.5 : 1,
          updated_at: new Date().toISOString(),
          recurrence_threshold_users: 3,
          recurrence_window_days: 15,
          active: true,
        },
        { onConflict: "client_id" }
      );
    if (configErr) throw configErr;
  },
  onSuccess: () => {
    toast.success("Dados do cliente atualizados");
    queryClient.invalidateQueries({ queryKey: ["client_detail", user?.id, slug] });
    queryClient.invalidateQueries({ queryKey: ["clients_list"] });
    queryClient.invalidateQueries({ queryKey: ["client_priority_config"] });
    queryClient.invalidateQueries({ queryKey: ["priority-scores"] });
  },
  onError: (err) => {
    toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : "Erro"));
  },
});
```

**Apos criar `saveClientMutation`, remover `saveScopeMutation`** — ele fica redundante.

---

## Tarefa 5 — Importar componentes necessarios

Verificar que estes componentes estao importados (adicionar se nao estiverem):

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

`Input`, `Textarea`, `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent` ja devem estar importados.

---

## Nao fazer

- Nao criar componente separado para o formulario — inline na tab
- Nao alterar outras tabs alem de "Regras de Negocio" (remover scope) e "Configuracoes" (adicionar formulario)
- Nao alterar backend
- Nao tocar em `src/integrations/supabase/*`

---

## CTO Checklist

- m1: zero `any` — tipos explicitos nos estados e mutation
- m3: toast sonner (ja importado no arquivo)
- m5: queryKey com todas as dependencias
- m8: erros Supabase destructurados e tratados
- m9: useMutation para escrita
- m11: zero imports nao usados (remover saveScopeMutation se substituido)

---

## Criterios de aceitacao

- Admin edita nome, status, scope e tier na tab Configuracoes
- Viewer ve campos em modo read-only
- Scope removido da tab "Regras de Negocio"
- Toast de sucesso/erro
- Queries invalidadas corretamente (cliente atualiza em todas as views)
- Dark mode correto nos selects e inputs
- Zero regressao nas outras tabs

---

## PR

- Titulo: `feat: edição de cliente na tab Configurações`
- Branch: `feat/client-edit-settings`
- Arquivos: ClientDetailPage.tsx (modificado)
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
