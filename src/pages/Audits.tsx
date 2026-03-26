import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell, ShieldAlert, ShieldCheck, AlertCircle, Pencil, Trash2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KPICard } from "@/components/KPICard";
import { useAuditAlerts } from "@/hooks/useAuditAlerts";
import { useAuditRules, type AuditRule } from "@/hooks/useAuditRules";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const METRIC_LABELS: Record<string, string> = {
  score_prioridade: "Score",
  tom_critico_pct: "% Crítico",
  volume_periodo: "Volume",
};

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

const PAGE_SIZE = 20;

const Audits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { data: summary, isLoading, isError, refetch } = useAuditAlerts();

  const [rulesPage, setRulesPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AuditRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditRule | null>(null);
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

  const { data: rulesData, isLoading: loadingRules } = useAuditRules({ page: rulesPage, limit: PAGE_SIZE });
  const rules = rulesData?.rules ?? [];
  const rulesTotalCount = rulesData?.totalCount ?? 0;

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
    setFormRecipients(
      Array.isArray(rule.alert_recipients) ? (rule.alert_recipients as unknown as Array<{ type: string; value: string }>) : []
    );
    setFormCooldownHours(rule.cooldown_hours ?? 24);
    setDialogOpen(true);
  }

  function handleSaveRule() {
    if (!formName || !formMetric) {
      toast.error("Nome e métrica são obrigatórios");
      return;
    }
    saveMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
          <p className="text-muted-foreground">
            Alertas automáticos baseados nos seus indicadores (Fase 6)
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 animate-shimmer" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 animate-shimmer" />
                <Skeleton className="h-3 w-20 mt-1 animate-shimmer" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card">
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-32 animate-shimmer" />
                <Skeleton className="h-5 w-24 animate-shimmer" />
                <Skeleton className="h-5 w-16 animate-shimmer" />
                <Skeleton className="h-5 flex-1 animate-shimmer" />
                <Skeleton className="h-5 w-20 animate-shimmer" />
                <Skeleton className="h-5 w-24 animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
          <p className="text-muted-foreground">
            Alertas automáticos baseados nos seus indicadores (Fase 6)
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar alertas</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados. Tente novamente.
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalAlerts = summary?.total_alerts_30d ?? 0;
  const unreadCount = summary?.unread_count ?? 0;
  const alerts = summary?.alerts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
        <p className="text-muted-foreground">
          Alertas automáticos baseados nos seus indicadores (Fase 6)
        </p>
      </div>

      <Tabs defaultValue="alertas">
        <TabsList>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="alertas" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <KPICard
            title="Total de alertas (30d)"
            value={String(totalAlerts)}
            subtitle="últimos 30 dias"
            icon={ShieldAlert}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <KPICard
            title="Não lidos"
            value={String(unreadCount)}
            subtitle={unreadCount > 0 ? "requerem atenção" : "todos lidos"}
            icon={Bell}
          />
        </div>
        {unreadCount > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <Badge variant="destructive" className="text-sm py-1 px-2">
              {unreadCount} não lido{unreadCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhum alerta nos últimos 30 dias</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Quando houver alertas baseados nas suas regras de auditoria, eles aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert, i) => (
                <TableRow
                  key={alert.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }}
                >
                  <TableCell className="font-medium text-sm">{alert.client_name}</TableCell>
                  <TableCell className="text-sm">
                    {METRIC_LABELS[alert.metric] ?? alert.metric}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {Number(alert.metric_value).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <span title={alert.message}>
                      {alert.message.length > 80 ? `${alert.message.slice(0, 80)}…` : alert.message}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.created_at), { locale: ptBR, addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs border-0 ${
                        alert.read
                          ? "bg-muted text-muted-foreground"
                          : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                      }`}
                    >
                      {alert.read ? "Lido" : "Não lido"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
        </TabsContent>

        <TabsContent value="regras" className="space-y-6">
          {isAdmin && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" /> Nova Regra
            </Button>
          )}
          {loadingRules ? (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-32 animate-shimmer" />
                  <Skeleton className="h-5 w-24 animate-shimmer" />
                  <Skeleton className="h-5 w-16 animate-shimmer" />
                  <Skeleton className="h-5 flex-1 animate-shimmer" />
                  <Skeleton className="h-5 w-20 animate-shimmer" />
                  <Skeleton className="h-5 w-24 animate-shimmer" />
                </div>
              ))}
            </div>
          ) : rules.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground">Nenhuma regra de auditoria cadastrada.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card">
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
                            <span className={rule.active ? "text-emerald-600" : "text-slate-400"}>
                              {rule.active ? "Sim" : "Não"}
                            </span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(rule)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rulesTotalCount > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      {rulesPage * PAGE_SIZE + 1}–{Math.min((rulesPage + 1) * PAGE_SIZE, rulesTotalCount)} de{" "}
                      {rulesTotalCount}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRulesPage((p) => p - 1)}
                        disabled={rulesPage === 0}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRulesPage((p) => p + 1)}
                        disabled={(rulesPage + 1) * PAGE_SIZE >= rulesTotalCount}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Descrição</Label>
              <Textarea rows={2} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Cliente</Label>
              <Select value={formClientId ?? "__all__"} onValueChange={(v) => setFormClientId(v === "__all__" ? null : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os clientes</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Métrica *</Label>
              <Select value={formMetric} onValueChange={setFormMetric}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_CONFIG).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Operador *</Label>
                <Select value={formOperator} onValueChange={setFormOperator}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Threshold *</Label>
                <Input
                  type="number"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Janela (horas)</Label>
                <Input
                  type="number"
                  value={formWindowHours}
                  onChange={(e) => setFormWindowHours(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Cooldown (horas)</Label>
                <Input
                  type="number"
                  value={formCooldownHours}
                  onChange={(e) => setFormCooldownHours(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Canal de alerta</Label>
              <Select value={formChannel} onValueChange={(v) => setFormChannel(v as "email" | "whatsapp" | "both")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Destinatários</Label>
              {formRecipients.map((r, i) => (
                <div key={`recipient-${r.value || i}`} className="flex gap-2 items-center">
                  <Select
                    value={r.type}
                    onValueChange={(v) => {
                      const updated = [...formRecipients];
                      updated[i] = { ...updated[i], type: v };
                      setFormRecipients(updated);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormRecipients(formRecipients.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormRecipients([...formRecipients, { type: "email", value: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar destinatário
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRule} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingRule ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra &quot;{deleteTarget?.name}&quot; será removida permanentemente. Esta ação não pode ser desfeita.
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
    </div>
  );
};

export default Audits;
