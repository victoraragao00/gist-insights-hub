# PR: feat: CRUD de audit_rules na página Auditorias

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Branch: `feat/audit-rules-crud`
Prioridade: ALTA
Issue: #60

Leia CONTEXT.md e docs/DESIGN_SYSTEM.md antes de comecar.

---

## Problema

A pagina Auditorias (`/audits`) exibe alertas disparados via `audit_alerts_summary()`. Nao existe UI para criar, editar ou deletar regras de auditoria. 39 regras existem seedadas na tabela `audit_rules`.

---

## Tarefa 1 — Hook useAuditRules

Criar `src/hooks/useAuditRules.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface AuditRule {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  metric: string;
  operator: string;
  threshold: number;
  window_hours: number | null;
  alert_channel: "email" | "whatsapp" | "both" | null;
  alert_recipients: unknown;
  cooldown_hours: number | null;
  active: boolean | null;
  created_at: string | null;
}

interface UseAuditRulesParams {
  page?: number;
  limit?: number;
}

export function useAuditRules(params: UseAuditRulesParams = {}) {
  const { user } = useAuth();
  const { page = 0, limit = 20 } = params;

  return useQuery<{ rules: AuditRule[]; totalCount: number }>({
    queryKey: ["audit-rules", user?.id, page],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const from = page * limit;
      const to = (page + 1) * limit - 1;
      const { data, error, count } = await supabase
        .from("audit_rules")
        .select("*, clients(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rules: AuditRule[] = (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        client_name: (row.clients as { name: string } | null)?.name ?? null,
      })) as AuditRule[];
      return { rules, totalCount: count ?? 0 };
    },
  });
}
```

---

## Tarefa 2 — METRIC_CONFIG

Definir no topo de `Audits.tsx` (ou num arquivo compartilhado):

```tsx
const METRIC_CONFIG: Record<string, string> = {
  score_prioridade: "Score de prioridade",
  tom_critico_pct: "% Tom crítico",
  tom_alerta_pct: "% Tom alerta",
  volume_periodo: "Volume no período",
  tone_critico_count: "Msgs críticas (contagem)",
  tone_alerta_count: "Msgs alerta (contagem)",
  tone_atencao_count: "Msgs atenção (contagem)",
  out_of_scope_pct: "% Fora do escopo",
  volume_daily: "Volume diário",
  after_hours_count: "Msgs fora do horário",
  response_time_avg: "Tempo médio de resposta (min)",
};

const OPERATOR_OPTIONS = [
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: "==", label: "==" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "both", label: "Ambos" },
];
```

---

## Tarefa 3 — Adicionar tabs em Audits.tsx

Envolver o conteudo atual da pagina em sistema de tabs:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dentro do return:
<Tabs defaultValue="alertas">
  <TabsList>
    <TabsTrigger value="alertas">Alertas</TabsTrigger>
    <TabsTrigger value="regras">Regras</TabsTrigger>
  </TabsList>

  <TabsContent value="alertas">
    {/* TODO: mover conteudo atual da pagina para ca (KPI cards + tabela de alertas) */}
  </TabsContent>

  <TabsContent value="regras">
    {/* TODO: tabela de regras + CRUD */}
  </TabsContent>
</Tabs>
```

---

## Tarefa 4 — Tab "Regras" — Tabela com paginacao

```tsx
const PAGE_SIZE = 20;
const [rulesPage, setRulesPage] = useState(0);
const { data: rulesData, isLoading: loadingRules } = useAuditRules({ page: rulesPage, limit: PAGE_SIZE });
const rules = rulesData?.rules ?? [];
const rulesTotalCount = rulesData?.totalCount ?? 0;
```

### Tabela

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nome</TableHead>
      <TableHead>Cliente</TableHead>
      <TableHead>Métrica</TableHead>
      <TableHead>Operador</TableHead>
      <TableHead>Threshold</TableHead>
      <TableHead>Ativo</TableHead>
      {isAdmin && <TableHead className="w-20">Ações</TableHead>}
    </TableRow>
  </TableHeader>
  <TableBody>
    {rules.map((rule) => (
      <TableRow key={rule.id}>
        <TableCell className="font-medium">{rule.name}</TableCell>
        <TableCell>{rule.client_name ?? "Todos"}</TableCell>
        <TableCell>{METRIC_CONFIG[rule.metric] ?? rule.metric}</TableCell>
        <TableCell>{rule.operator}</TableCell>
        <TableCell>{rule.threshold}</TableCell>
        <TableCell>
          {isAdmin ? (
            <Switch
              checked={rule.active ?? false}
              onCheckedChange={(checked) => toggleMutation.mutate({ ruleId: rule.id, active: checked })}
            />
          ) : (
            <span className={rule.active ? "text-emerald-600" : "text-slate-400"}>{rule.active ? "Sim" : "Não"}</span>
          )}
        </TableCell>
        {isAdmin && (
          <TableCell>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(rule)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Paginacao (mesmo padrao de ClientsPage)

```tsx
{rulesTotalCount > PAGE_SIZE && (
  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
    <span className="text-sm text-muted-foreground">
      {rulesPage * PAGE_SIZE + 1}–{Math.min((rulesPage + 1) * PAGE_SIZE, rulesTotalCount)} de {rulesTotalCount}
    </span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setRulesPage((p) => p - 1)} disabled={rulesPage === 0}>
        Anterior
      </Button>
      <Button variant="outline" size="sm" onClick={() => setRulesPage((p) => p + 1)} disabled={(rulesPage + 1) * PAGE_SIZE >= rulesTotalCount}>
        Próximo
      </Button>
    </div>
  </div>
)}
```

### Botao "Nova Regra" (admin only)

Acima da tabela:

```tsx
{isAdmin && (
  <Button onClick={() => openCreateDialog()}>
    <Plus className="h-4 w-4 mr-2" /> Nova Regra
  </Button>
)}
```

### Loading e empty states

- Loading: Skeletons shimmer
- Empty: "Nenhuma regra de auditoria cadastrada"

---

## Tarefa 5 — Dialog de criacao/edicao

Usar `Dialog` (Design System 3.1 — formulario rico):

```tsx
const [dialogOpen, setDialogOpen] = useState(false);
const [editingRule, setEditingRule] = useState<AuditRule | null>(null);

// Estados do formulario
const [formName, setFormName] = useState("");
const [formDescription, setFormDescription] = useState("");
const [formClientId, setFormClientId] = useState<string | null>(null);
const [formMetric, setFormMetric] = useState("");
const [formOperator, setFormOperator] = useState(">=");
const [formThreshold, setFormThreshold] = useState(0);
const [formWindowHours, setFormWindowHours] = useState(24);
const [formChannel, setFormChannel] = useState<"email" | "whatsapp" | "both">("email");
const [formRecipients, setFormRecipients] = useState<Array<{ type: string; value: string }>>([]);
const [formCooldownHours, setFormCooldownHours] = useState(24);
```

### Abrir para criar

```tsx
function openCreateDialog() {
  setEditingRule(null);
  setFormName("");
  setFormDescription("");
  setFormClientId(null);
  setFormMetric("");
  setFormOperator(">=");
  setFormThreshold(0);
  setFormWindowHours(24);
  setFormChannel("email");
  setFormRecipients([]);
  setFormCooldownHours(24);
  setDialogOpen(true);
}
```

### Abrir para editar

```tsx
function openEditDialog(rule: AuditRule) {
  setEditingRule(rule);
  setFormName(rule.name);
  setFormDescription(rule.description ?? "");
  setFormClientId(rule.client_id);
  setFormMetric(rule.metric);
  setFormOperator(rule.operator);
  setFormThreshold(rule.threshold);
  setFormWindowHours(rule.window_hours ?? 24);
  setFormChannel(rule.alert_channel ?? "email");
  setFormRecipients(Array.isArray(rule.alert_recipients) ? rule.alert_recipients as Array<{ type: string; value: string }> : []);
  setFormCooldownHours(rule.cooldown_hours ?? 24);
  setDialogOpen(true);
}
```

### Campos do Dialog

```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      {/* Nome */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Nome *</label>
        <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
      </div>

      {/* Descricao */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Descrição</label>
        <Textarea rows={2} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
      </div>

      {/* Cliente */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Cliente</label>
        <Select value={formClientId ?? "__all__"} onValueChange={(v) => setFormClientId(v === "__all__" ? null : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metrica */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Métrica *</label>
        <Select value={formMetric} onValueChange={setFormMetric}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {Object.entries(METRIC_CONFIG).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operador + Threshold (lado a lado) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Operador *</label>
          <Select value={formOperator} onValueChange={setFormOperator}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Threshold *</label>
          <Input type="number" value={formThreshold} onChange={(e) => setFormThreshold(Number(e.target.value))} />
        </div>
      </div>

      {/* Janela + Cooldown (lado a lado) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Janela (horas)</label>
          <Input type="number" value={formWindowHours} onChange={(e) => setFormWindowHours(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Cooldown (horas)</label>
          <Input type="number" value={formCooldownHours} onChange={(e) => setFormCooldownHours(Number(e.target.value))} />
        </div>
      </div>

      {/* Canal de alerta */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Canal de alerta</label>
        <Select value={formChannel} onValueChange={(v) => setFormChannel(v as "email" | "whatsapp" | "both")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Destinatarios (campo dinamico) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Destinatários</label>
        {formRecipients.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Select value={r.type} onValueChange={(v) => {
              const updated = [...formRecipients];
              updated[i] = { ...updated[i], type: v };
              setFormRecipients(updated);
            }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="flex-1"
              placeholder={r.type === "email" ? "email@exemplo.com" : "+5511999999999"}
              value={r.value}
              onChange={(e) => {
                const updated = [...formRecipients];
                updated[i] = { ...updated[i], value: e.target.value };
                setFormRecipients(updated);
              }}
            />
            <Button variant="ghost" size="icon" onClick={() => setFormRecipients(formRecipients.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setFormRecipients([...formRecipients, { type: "email", value: "" }])}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar destinatário
        </Button>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
      <Button onClick={handleSaveRule} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Salvando..." : editingRule ? "Salvar" : "Criar"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Tarefa 6 — Mutations

### Save (create/edit)

```tsx
const saveMutation = useMutation({
  mutationFn: async () => {
    const payload = {
      name: formName,
      description: formDescription || null,
      client_id: formClientId,
      metric: formMetric,
      operator: formOperator,
      threshold: formThreshold,
      window_hours: formWindowHours,
      alert_channel: formChannel,
      alert_recipients: formRecipients,
      cooldown_hours: formCooldownHours,
    };

    if (editingRule) {
      const { error } = await supabase.from("audit_rules").update(payload).eq("id", editingRule.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("audit_rules").insert(payload);
      if (error) throw error;
    }
  },
  onSuccess: () => {
    toast.success(editingRule ? "Regra atualizada" : "Regra criada");
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["audit-rules"] });
  },
  onError: (err) => {
    const msg = err instanceof Error ? err.message : "Erro";
    if (msg.includes("audit_rules_client_metric_unique")) {
      toast.error("Já existe uma regra para esta métrica neste cliente");
    } else {
      toast.error("Erro: " + msg);
    }
  },
});

function handleSaveRule() {
  if (!formName || !formMetric) {
    toast.error("Nome e métrica são obrigatórios");
    return;
  }
  saveMutation.mutate();
}
```

### Toggle

```tsx
const toggleMutation = useMutation({
  mutationFn: async ({ ruleId, active }: { ruleId: string; active: boolean }) => {
    const { error } = await supabase.from("audit_rules").update({ active }).eq("id", ruleId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["audit-rules"] });
  },
  onError: () => toast.error("Erro ao atualizar regra"),
});
```

### Delete

```tsx
const [deleteTarget, setDeleteTarget] = useState<AuditRule | null>(null);

const deleteMutation = useMutation({
  mutationFn: async (ruleId: string) => {
    const { error } = await supabase.from("audit_rules").delete().eq("id", ruleId);
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success("Regra removida");
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["audit-rules"] });
  },
  onError: () => toast.error("Erro ao remover regra"),
});
```

### AlertDialog de confirmacao

```tsx
<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remover regra?</AlertDialogTitle>
      <AlertDialogDescription>
        A regra "{deleteTarget?.name}" será removida permanentemente. Esta ação não pode ser desfeita.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700"
        onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      >
        {deleteMutation.isPending ? "Removendo..." : "Remover"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Tarefa 7 — Lista de clientes para o select

Carregar clientes ativos para o dropdown do formulario:

```tsx
const { data: clients = [] } = useQuery<Array<{ id: string; name: string }>>({
  queryKey: ["clients_options_rules", user?.id],
  enabled: !!user?.id,
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .in("status", ["ativo", "trial"])
      .order("name");
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; name: string }>;
  },
});
```

---

## Tarefa 8 — Importar useUserRole

```tsx
import { useUserRole } from "@/hooks/useUserRole";

// Dentro do componente:
const { isAdmin } = useUserRole();
```

---

## Nao fazer

- Nao alterar a tab "Alertas" (conteudo atual da pagina)
- Nao alterar backend
- Nao tocar em `src/integrations/supabase/*`
- Nao instalar libs adicionais

---

## CTO Checklist

- m1: zero `any` — tipar AuditRule, formRecipients
- m3: toast sonner (importar de "sonner")
- m4: staleTime 30s para audit_rules
- m5: queryKey com user?.id e page
- m7: guard: validar formName e formMetric antes de submit
- m8: erros Supabase destructurados e tratados
- m9: useMutation para create/edit/delete/toggle (4 mutations)
- m11: zero imports nao usados
- m12: paginacao real com PAGE_SIZE=20

---

## Criterios de aceitacao

- Tabs "Alertas" e "Regras" funcionais em /audits
- Tabela de regras com paginacao real (PAGE_SIZE=20)
- Dialog de criacao/edicao com todos os 10 campos
- Toggle ativo/inativo inline (Switch)
- Deletar com AlertDialog de confirmacao
- Campo dinamico de destinatarios (adicionar/remover)
- Admin: todas as acoes. Viewer: tabela read-only
- Erro de constraint duplicata tratado com toast amigavel
- Dark mode correto
- Zero regressao na tab Alertas

---

## PR

- Titulo: `feat: CRUD de audit_rules na página Auditorias`
- Branch: `feat/audit-rules-crud`
- Arquivos: Audits.tsx (modificado), useAuditRules.ts (novo)
- Abrir PR no GitHub com `gh pr create` (OBRIGATORIO)
